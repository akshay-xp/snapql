import type { Entry } from "../capture/entry"
import { rowLabel } from "./row"

export type Segment = { text: string; hit: boolean }

export function matchesQuery(
  entry: Pick<Entry, "method" | "url" | "status" | "decoded">,
  query: string,
): boolean {
  const q = query.toLowerCase()
  if (!q) return true
  const { title, detail, kind } = rowLabel(entry)
  return [title, detail, kind, entry.url].some((field) =>
    field?.toLowerCase().includes(q),
  )
}

export function highlight(text: string, query: string): Segment[] {
  const q = query.toLowerCase()
  if (!q) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const segments: Segment[] = []
  let from = 0
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, from)) {
    if (at > from) segments.push({ text: text.slice(from, at), hit: false })
    segments.push({ text: text.slice(at, at + q.length), hit: true })
    from = at + q.length
  }
  if (from < text.length) segments.push({ text: text.slice(from), hit: false })
  return segments
}
