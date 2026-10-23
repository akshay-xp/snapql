import type { Entry } from "../capture/entry"
import { rowLabel } from "./row"

export type Segment = { text: string; hit: boolean }

export function matchesQuery(
  entry: Pick<Entry, "method" | "url" | "status" | "decoded">,
  query: string,
  bodyText?: string,
): boolean {
  const q = query.toLowerCase()
  if (!q) return true
  const { title, detail, kind } = rowLabel(entry)
  return [title, detail, kind, entry.url, bodyText].some((field) =>
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

export function excerpt(text: string, query: string): string | undefined {
  const flat = text.replace(/\s+/g, " ").trim()
  const at = flat.toLowerCase().indexOf(query.toLowerCase())
  if (at === -1) return
  const from = Math.max(0, at - 20)
  const to = at + query.length + 60
  return `${from > 0 ? "…" : ""}${flat.slice(from, to)}${to < flat.length ? "…" : ""}`
}

export type Filters = { kinds: string[]; statuses: string[] }

type Filterable = Pick<Entry, "status" | "decoded">

export const kindOf = (entry: Filterable) => entry.decoded?.kind ?? "other"

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

const allows = (selected: string[], value: string) =>
  !selected.length || selected.includes(value)

export const matchesFilters = (entry: Filterable, filters: Filters) =>
  allows(filters.kinds, kindOf(entry)) &&
  allows(filters.statuses, statusGroup(entry.status))

export function toggle(
  filters: Filters,
  group: keyof Filters,
  value: string,
): Filters {
  const values = filters[group]
  return {
    ...filters,
    [group]: values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value],
  }
}

export const prune = (filters: Filters, chips: Filters): Filters => ({
  kinds: filters.kinds.filter((k) => chips.kinds.includes(k)),
  statuses: filters.statuses.filter((s) => chips.statuses.includes(s)),
})
