import type { Body } from "../capture/entry"

export type FormattedBody = { text: string; notes: string[] }

// Bigger bodies are cut and never parsed, so a huge payload can't freeze the panel.
export const BODY_LIMIT = 1024 * 1024

export function formatBody(body: Body): FormattedBody {
  const base64 = body.encoding === "base64"
  const notes = base64
    ? [`base64-encoded, ${base64Bytes(body.content)} bytes`]
    : []
  if (body.content.length > BODY_LIMIT) {
    notes.push(`Truncated: showing 1 MB of ${body.content.length} characters`)
    return { text: body.content.slice(0, BODY_LIMIT), notes }
  }
  if (base64) return { text: body.content, notes }
  return { text: prettyJson(body.content) ?? body.content, notes }
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
