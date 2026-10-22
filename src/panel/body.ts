import type { Body } from "../capture/entry"

export type FormattedBody = { text: string; notes: string[] }

export function formatBody(body: Body): FormattedBody {
  return { text: prettyJson(body.content) ?? body.content, notes: [] }
}

function prettyJson(text: string): string | undefined {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return undefined
  }
}
