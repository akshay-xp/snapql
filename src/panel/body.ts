import type { Body, Entry } from "../capture/entry"
import { baseMime } from "../decoders/text"
import { prettyXml } from "../decoders/xml"
import { decodeBase64 } from "./values"

// How the Body tab shows a body; absent means text (pretty-printed if it can be).
export type BodyViewKind = "image" | "font" | "hex"

export type FormattedBody = {
  text: string
  notes: string[]
  view?: BodyViewKind
}

export type FormatOptions = { pretty?: boolean; mimeType?: string }

// With the Response group, the panel's only getBody() caller, so bodies load
// only where they are shown.
export async function loadBody(
  entry: Pick<Entry, "getBody" | "mimeType">,
  options?: { pretty?: boolean },
): Promise<FormattedBody> {
  try {
    return formatBody(await entry.getBody(), {
      ...options,
      mimeType: entry.mimeType,
    })
  } catch (err) {
    return { text: "", notes: [`Body unavailable: ${(err as Error).message}`] }
  }
}

// Bigger bodies are cut and never parsed, so a huge payload can't freeze the panel.
export const BODY_LIMIT = 1024 * 1024

export function formatBody(
  body: Body,
  { pretty = true, mimeType = "" }: FormatOptions = {},
): FormattedBody {
  if (body.encoding === "base64" && isTextMime(mimeType))
    body = { content: decodeBase64(body.content), encoding: "" }
  const base64 = body.encoding === "base64"
  const view = bodyView(base64, mimeType)
  const result = (text: string, notes: string[]): FormattedBody =>
    view ? { text, notes, view } : { text, notes }
  const notes = base64
    ? [`base64-encoded, ${base64Bytes(body.content)} bytes`]
    : []
  // Images and fonts render rather than parse, so they are never cut.
  if (view !== "image" && view !== "font" && body.content.length > BODY_LIMIT) {
    notes.push(`Truncated: showing 1 MB of ${body.content.length} characters`)
    return result(body.content.slice(0, BODY_LIMIT), notes)
  }
  if (base64 || !pretty) return result(body.content, notes)
  return result(prettyJson(body.content) ?? prettyXml(body.content), notes)
}

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
])
const FONT_MIMES = new Set([
  "font/woff2",
  "font/woff",
  "font/ttf",
  "font/otf",
  "application/font-woff",
])

function bodyView(base64: boolean, mimeType: string): BodyViewKind | undefined {
  const mime = baseMime(mimeType)
  if (mime === "image/svg+xml" || (base64 && IMAGE_MIMES.has(mime)))
    return "image"
  if (base64) return FONT_MIMES.has(mime) ? "font" : "hex"
}

function base64Bytes(content: string): number {
  const padding = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0
  return Math.floor((content.length * 3) / 4) - padding
}

function prettyJson(text: string): string | undefined {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return undefined
  }
}

const isTextMime = (mimeType: string) =>
  /^text\/|^multipart\/mixed$|[/+]json$|xml|javascript/.test(baseMime(mimeType))

// SVG arrives as source text; other images as base64.
export function imageSrc(text: string, mimeType: string): string {
  const mime = baseMime(mimeType)
  return mime === "image/svg+xml"
    ? `data:${mime};charset=utf-8,${encodeURIComponent(text)}`
    : `data:${mime};base64,${text}`
}
