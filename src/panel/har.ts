import type { Body, Entry, NameValue, Timings } from "../capture/entry"
import { base64Bytes } from "./body"

export type HarEntry = {
  startedDateTime: string
  time: number
  request: {
    method: string
    url: string
    httpVersion: string
    cookies: NameValue[]
    headers: NameValue[]
    queryString: NameValue[]
    postData?: { mimeType: string; text: string }
    headersSize: number
    bodySize: number
  }
  response: {
    status: number
    statusText: string
    httpVersion: string
    cookies: NameValue[]
    headers: NameValue[]
    content: {
      size: number
      mimeType: string
      text?: string
      encoding?: string
    }
    redirectURL: string
    headersSize: number
    bodySize: number
  }
  cache: Record<string, never>
  timings: Timings
  _resourceType?: "websocket"
  _webSocketMessages?: {
    type: "send" | "receive"
    time: number
    opcode: 1 | 2
    data: string
  }[]
}

export type Har = {
  log: {
    version: "1.2"
    creator: { name: string; version: string }
    pages: []
    entries: HarEntry[]
  }
}

export function toHar(
  entries: readonly Entry[],
  bodies: readonly (Body | undefined)[],
  version: string,
): Har {
  return {
    log: {
      version: "1.2",
      creator: { name: "SnapQL", version },
      pages: [],
      entries: entries.map((e, i) => harEntry(e, bodies[i])),
    },
  }
}

// HAR 1.2 requires send, wait and receive to be non-negative.
const required = (ms: number) => Math.max(ms, 0)

function harEntry(entry: Entry, body: Body | undefined): HarEntry {
  const { exchange } = entry
  const httpVersion = exchange.httpVersion || "HTTP/1.1"
  const base64 = body?.encoding === "base64"
  return {
    startedDateTime: new Date(entry.startedAt).toISOString(),
    time: entry.time,
    request: {
      method: entry.method,
      url: entry.url,
      httpVersion,
      cookies: exchange.requestCookies,
      headers: exchange.requestHeaders,
      queryString: exchange.queryString,
      ...(entry.requestBody && { postData: entry.requestBody }),
      headersSize: -1,
      bodySize: entry.requestBody?.text.length ?? 0,
    },
    response: {
      status: entry.status,
      statusText: exchange.statusText,
      httpVersion,
      cookies: exchange.responseCookies,
      headers: exchange.responseHeaders,
      content: {
        size: !body
          ? 0
          : base64
            ? base64Bytes(body.content)
            : body.content.length,
        mimeType: entry.mimeType,
        ...(body && { text: body.content }),
        ...(base64 && { encoding: "base64" }),
      },
      redirectURL: "",
      headersSize: -1,
      bodySize: exchange.size,
    },
    cache: {},
    timings: {
      ...exchange.timings,
      send: required(exchange.timings.send),
      wait: required(exchange.timings.wait),
      receive: required(exchange.timings.receive),
    },
    ...(entry.socket && {
      _resourceType: "websocket" as const,
      // Chrome's own HAR layout, so DevTools can import it.
      _webSocketMessages: (entry.messages ?? []).map((m) => ({
        type: m.dir === "out" ? ("send" as const) : ("receive" as const),
        time: m.time / 1000,
        opcode: m.base64 === undefined ? (1 as const) : (2 as const),
        data: m.base64 ?? m.text,
      })),
    }),
  }
}

const pad = (n: number) => String(n).padStart(2, "0")

// Hostname, not host: a port's ":" is not allowed in Windows file names.
export function harFileName(
  entries: readonly Pick<Entry, "url">[],
  now: Date,
): string {
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const host = entries[0] ? `${new URL(entries[0].url).hostname}-` : ""
  return `snapql-${host}${date}-${time}.har`
}
