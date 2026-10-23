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

export type Filters = { kinds: string[]; statuses: string[] }

type Filterable = Pick<Entry, "status" | "decoded">

export const kindOf = (entry: Pick<Entry, "decoded">) =>
  entry.decoded?.kind ?? "other"

export const statusGroup = (status: number) =>
  status === 0 ? "failed" : `${Math.floor(status / 100)}xx`

const sorted = (values: Iterable<string>, last: string) =>
  [...new Set(values)].sort((a, b) =>
    a === last ? 1 : b === last ? -1 : a.localeCompare(b),
  )

export function chipsFor(entries: readonly Filterable[]): Filters {
  return {
    kinds: sorted(entries.map(kindOf), "other"),
    statuses: sorted(
      entries.map((e) => statusGroup(e.status)),
      "failed",
    ),
  }
}
