import type { Entry } from "../capture/entry"
import { byteLabel } from "./messages"
import { cleanClose } from "./socket"

export type Heading = {
  // Decoded only; otherwise the URL is the title.
  title?: string
  tag?: string
  method: string
  url: string
  query: string
  status: string
  ok: boolean
  time: string
  size?: string
  protocol?: string
  remote?: string
  cache?: string
  clock: string
}

// HTTP/2 and later carry no reason phrase, so Chrome reports an empty one.
const reasons: Record<number, string> = {
  100: "Continue",
  101: "Switching Protocols",
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Content Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a teapot",
  421: "Misdirected Request",
  422: "Unprocessable Content",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  507: "Insufficient Storage",
  508: "Loop Detected",
  511: "Network Authentication Required",
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
  const { decoded, status, exchange } = entry
  const closeCode = entry.socket?.closeCode
  const { origin, pathname, search } = new URL(entry.url)
  const started = new Date(entry.startedAt)
  const reason = exchange.statusText || reasons[status]
  return {
    ...(decoded && {
      ...(decoded.title !== pathname && { title: decoded.title }),
      tag: [decoded.kind, decoded.detail !== entry.method && decoded.detail]
        .filter(Boolean)
        .join(" "),
    }),
    method: entry.method,
    url: origin + pathname,
    query: search,
    ...(closeCode === undefined
      ? {
          status:
            status === 0
              ? "failed"
              : reason
                ? `${status} ${reason}`
                : String(status),
          ok: status > 0 && status < 400,
        }
      : { status: `closed ${closeCode}`, ok: cleanClose(closeCode) }),
    time: `${Math.round(entry.time)} ms`,
    ...(exchange.size > 0 && { size: byteLabel(exchange.size) }),
    ...(exchange.httpVersion && { protocol: exchange.httpVersion }),
    ...(exchange.remoteAddress && { remote: exchange.remoteAddress }),
    ...(exchange.fromCache && { cache: `${exchange.fromCache} cache` }),
    clock: [started.getHours(), started.getMinutes(), started.getSeconds()]
      .map(pad)
      .join(":"),
  }
}
