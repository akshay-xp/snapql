import type { Entry } from "../capture/entry"
import { count } from "../decoders/text"
import { contentKind } from "./asset"
import { failureOf } from "./failure"

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
    | "method"
    | "url"
    | "status"
    | "decoded"
    | "messages"
    | "open"
    | "socket"
    | "mimeType"
    | "exchange"
  >,
): RowLabel {
  const { decoded } = entry
  const failure = failureOf(entry)
  const { pathname, search } = new URL(entry.url)
  const content = !decoded && contentKind(entry)
  const detail = decoded ? decoded.detail : entry.method
  const kind = decoded?.kind || content
  return {
    // Sockets read by URL even when decoded: their decoder title is the bare
    // path, and a socket on "/" would leave nothing to tell rows apart.
    ...(decoded && entry.method !== "WS"
      ? { title: decoded.title }
      : {
          // Query kept so repeated calls to one endpoint stay distinguishable.
          title: pathname + search,
          parts: [...splitPath(pathname), search],
        }),
    ...(detail !== undefined && { detail }),
    ...(kind && { kind }),
    ...(failure && { failure }),
    ...(entry.open && { live: true as const }),
    ...(entry.socket?.closeCode !== undefined && {
      closed: `closed ${entry.socket.closeCode}`,
    }),
    ...(entry.messages && { count: count(entry.messages.length, "msg") }),
  }
}
