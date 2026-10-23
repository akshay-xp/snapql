import type { Entry } from "../capture/entry"
import { count } from "../decoders/text"

export type RowLabel = {
  title: string
  detail?: string
  kind?: string
  failure?: string
  count?: string
}

export function rowLabel(
  entry: Pick<Entry, "method" | "url" | "status" | "decoded" | "messages">,
): RowLabel {
  const { decoded, status } = entry
  const failure =
    status === 0 ? "failed" : status >= 400 ? String(status) : undefined
  const url = new URL(entry.url)
  return {
    // Query kept so repeated calls to one endpoint stay distinguishable.
    title: decoded ? decoded.title : url.pathname + url.search,
    ...(decoded
      ? {
          ...(decoded.detail !== undefined && { detail: decoded.detail }),
          kind: decoded.kind,
        }
      : { detail: entry.method }),
    ...(failure && { failure }),
    ...(entry.messages && { count: count(entry.messages.length, "msg") }),
  }
}
