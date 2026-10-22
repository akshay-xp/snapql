import type { Body, Entry } from "../capture/entry"
import { baseMime } from "../decoders/text"
import { prettyXml } from "../decoders/xml"

export type FormattedBody = { text: string; notes: string[] }

export type FormatOptions = { pretty?: boolean; mimeType?: string }

// The panel's only getBody() caller, so bodies load only where this is used.
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
  const notes = base64
    ? [`base64-encoded, ${base64Bytes(body.content)} bytes`]
    : []
  if (body.content.length > BODY_LIMIT) {
    notes.push(`Truncated: showing 1 MB of ${body.content.length} characters`)
    return { text: body.content.slice(0, BODY_LIMIT), notes }
  }
  if (base64 || !pretty) return { text: body.content, notes }
  return { text: prettyJson(body.content) ?? prettyXml(body.content), notes }
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
  /^text\/|[/+]json$|xml|javascript/.test(baseMime(mimeType))

function decodeBase64(content: string): string {
  return new TextDecoder().decode(
    Uint8Array.from(atob(content), (c) => c.charCodeAt(0)),
  )
}
