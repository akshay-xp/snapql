import type { Entry } from "../capture/entry"
import { count } from "../decoders/text"

// [clips first, kept, muted]
export type Parts = [string, string, string?]

export type RowLabel = {
  title: string
  // Undecoded only: title as [leading path, last segment, query], so the row
  // can clip the leading path and keep the end, which identifies the request.
  parts?: Parts
  detail?: string
  kind?: string
  failure?: string
  count?: string
  live?: true
  closed?: string
}

// Before the last segment; a trailing slash stays with that segment.
export function splitPath(pathname: string): [string, string] {
  const cut = pathname.slice(0, -1).lastIndexOf("/") + 1
  return [pathname.slice(0, cut), pathname.slice(cut)]
}

export function rowLabel(
  entry: Pick<
    Entry,
    "method" | "url" | "status" | "decoded" | "messages" | "open" | "socket"
  >,
): RowLabel {
  const { decoded, status } = entry
  const failure =
    status === 0 ? "failed" : status >= 400 ? String(status) : undefined
  const { pathname, search } = new URL(entry.url)
  return {
    ...(decoded
      ? {
          title: decoded.title,
          ...(decoded.detail !== undefined && { detail: decoded.detail }),
          kind: decoded.kind,
        }
      : {
          // Query kept so repeated calls to one endpoint stay distinguishable.
          title: pathname + search,
          parts: [...splitPath(pathname), search],
          detail: entry.method,
        }),
    ...(failure && { failure }),
    ...(entry.open && { live: true as const }),
    ...(entry.socket?.closeCode !== undefined && {
      closed: `closed ${entry.socket.closeCode}`,
    }),
    ...(entry.messages && { count: count(entry.messages.length, "msg") }),
  }
}
