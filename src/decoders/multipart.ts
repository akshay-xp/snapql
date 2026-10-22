import { baseMime, count } from "./text"
import type { Decoder } from "./types"

export type Part = {
  name: string
  filename?: string
  type?: string
  content: string
}

export function parseMultipart(text: string, boundary: string): Part[] {
  const parts: Part[] = []
  for (const segment of text.split(`--${boundary}`).slice(1)) {
    if (segment.startsWith("--")) break
    const raw = segment.replace(/^\r?\n/, "").replace(/\r?\n$/, "")
    const blank = raw.match(/\r?\n\r?\n/)
    if (!blank?.index) continue
    const headers = raw.slice(0, blank.index)
    const name = param(headers, "name")
    if (name === undefined) continue
    const filename = param(headers, "filename")
    const type = headers.match(/^content-type:\s*(.+)$/im)?.[1].trim()
    parts.push({
      name,
      ...(filename === undefined ? {} : { filename }),
      ...(type === undefined ? {} : { type }),
      content: raw.slice(blank.index + blank[0].length),
    })
  }
  return parts
}

function param(headers: string, key: string): string | undefined {
  return headers.match(new RegExp(`[;\\s]${key}="([^"]*)"`, "i"))?.[1]
}

export function multipartParts(body: {
  mimeType: string
  text: string
}): Part[] | undefined {
  if (baseMime(body.mimeType) !== "multipart/form-data") return
  const boundary = body.mimeType.match(/boundary="?([^";]+)"?/i)?.[1]
  return boundary ? parseMultipart(body.text, boundary) : undefined
}

export const multipart: Decoder = {
  kind: "multipart",
  decode(req) {
    const parts = req.requestBody && multipartParts(req.requestBody)
    if (!parts) return
    const fields = parts
      .filter((p) => p.filename === undefined)
      .map((p) => ({ name: p.name, value: p.content }))
    const files = fileRows(parts)
    const summary = [
      fields.length ? count(fields.length, "field") : "",
      files.length ? count(files.length, "file") : "",
    ]
      .filter(Boolean)
      .join(", ")
    return { summary, data: { fields, files } }
  },
}

export const fileRows = (parts: Part[]) =>
  parts
    .filter((p) => p.filename !== undefined)
    .map((p) => ({ name: p.name, value: fileValue(p) }))

// Browsers may leave file contents out of the captured body.
function fileValue(p: Part): string {
  const size = p.content
    ? count(new TextEncoder().encode(p.content).length, "byte")
    : "size unknown"
  return `${p.filename} (${p.type ?? "application/octet-stream"}, ${size})`
}
