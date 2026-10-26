import type { Entry } from "../capture/entry"
import { baseMime } from "../decoders/text"
import type { BodyTexts } from "./body-index"
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

export type BodyHit = {
  side: "request" | "response"
  count: number
  excerpt: string
}

export function bodyHit(texts: BodyTexts, query: string): BodyHit | undefined {
  for (const side of ["response", "request"] as const) {
    const shown = excerpt(texts[side], query)
    if (shown === undefined) continue
    const count = highlight(texts[side], query).filter((s) => s.hit).length
    return { side, count, excerpt: shown }
  }
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

export type Hide = { preflights: boolean; cached: boolean; assets: boolean }

export const noHide: Hide = { preflights: false, cached: false, assets: false }

// Noise is off until asked for: most sessions target the app's own calls.
export const defaultHide: Hide = {
  preflights: true,
  cached: true,
  assets: true,
}

const ASSET_PREFIXES = ["image/", "font/", "video/", "audio/"]
const ASSET_MIMES = new Set([
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "application/wasm",
])

const isAsset = (mimeType: string) => {
  const mime = baseMime(mimeType)
  return ASSET_MIMES.has(mime) || ASSET_PREFIXES.some((p) => mime.startsWith(p))
}

export const isHidden = (
  entry: Pick<Entry, "method" | "status" | "mimeType" | "exchange">,
  hide: Hide,
) =>
  (hide.preflights && entry.method === "OPTIONS") ||
  (hide.cached && (!!entry.exchange.fromCache || entry.status === 304)) ||
  (hide.assets && isAsset(entry.mimeType))
