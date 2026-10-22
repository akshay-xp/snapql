import type { Body } from "../capture/entry"

export type FormattedBody = { text: string; notes: string[] }

export function formatBody(body: Body): FormattedBody {
  if (body.encoding === "base64") {
    return {
      text: body.content,
      notes: [`base64-encoded, ${base64Bytes(body.content)} bytes`],
    }
  }
  return { text: prettyJson(body.content) ?? body.content, notes: [] }
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
