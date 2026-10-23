import type { Entry } from "../capture/entry"
import { rowLabel } from "./row"
import { cleanClose } from "./socket"

export type Heading = {
  title: string
  tag?: string
  method: string
  path: string
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
  const url = new URL(entry.url)
  const started = new Date(entry.startedAt)
  return {
    title: rowLabel(entry).title,
    ...(decoded && {
      tag: [decoded.kind, decoded.detail].filter(Boolean).join(" "),
    }),
    method: entry.method,
    path: url.pathname + url.search,
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
