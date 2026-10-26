import type { Entry } from "../capture/entry"
import { byteLabel } from "./messages"
import { type Parts, rowLabel, splitPath } from "./row"
import { cleanClose } from "./socket"

export type Heading = {
  title: string
  titleParts: Parts
  tag?: string
  method: string
  // Host, plus the path when the title is something else (an operation name).
  url: Parts
  // Query parameter count, when the title doesn't already show the query.
  params?: number
  size?: string
  cache?: string
  status: string
  ok: boolean
  time: string
  clock: string
}

const pad = (n: number) => String(n).padStart(2, "0")

export function summaryHeading(
  entry: Pick<
    Entry,
    | "method"
    | "url"
    | "status"
    | "time"
    | "startedAt"
    | "decoded"
    | "exchange"
    | "socket"
  >,
): Heading {
  const { decoded, status } = entry
  const closeCode = entry.socket?.closeCode
  const { host, pathname, search } = new URL(entry.url)
  const started = new Date(entry.startedAt)
  const { title } = rowLabel(entry)
  const titleIsPath = title === pathname || title === pathname + search
  const [lead, last] = splitPath(pathname)
  const params =
    titleIsPath && title !== pathname ? 0 : entry.exchange.queryString.length
  const { size, fromCache } = entry.exchange
  return {
    title,
    titleParts: titleIsPath
      ? [lead, last, title.slice(pathname.length)]
      : ["", title],
    ...(decoded && {
      tag: [decoded.kind, decoded.detail !== entry.method && decoded.detail]
        .filter(Boolean)
        .join(" "),
    }),
    method: entry.method,
    url: titleIsPath ? ["", host] : [host + lead, last],
    ...(params > 0 && { params }),
    ...(size > 0 && { size: byteLabel(size) }),
    ...(fromCache && { cache: `${fromCache} cache` }),
    ...(closeCode === undefined
      ? {
          status:
            status === 0
              ? "failed"
              : `${status} ${entry.exchange.statusText}`.trim(),
          ok: status > 0 && status < 400,
        }
      : { status: `closed ${closeCode}`, ok: cleanClose(closeCode) }),
    time: `${Math.round(entry.time)} ms`,
    clock: [started.getHours(), started.getMinutes(), started.getSeconds()]
      .map(pad)
      .join(":"),
  }
}
