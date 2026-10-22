import type { DecodeResult, RequestView } from "../decoders/types"

export type Body = { content: string; encoding: string }

export type NameValue = { name: string; value: string }

// HAR phases in ms; -1 means the phase did not apply or was not reported.
export type Timings = {
  blocked: number
  dns: number
  connect: number
  ssl: number
  send: number
  wait: number
  receive: number
}

export type Exchange = {
  requestHeaders: NameValue[]
  responseHeaders: NameValue[]
  queryString: NameValue[]
  requestCookies: NameValue[]
  responseCookies: NameValue[]
  httpVersion: string
  statusText: string
  size: number
  timings: Timings
}

export type FinishedRequest = RequestView & {
  exchange: Exchange
  startedDateTime: string
  time: number
  fetchBody: () => Promise<Body>
}

export type Entry = {
  id: number
  method: string
  url: string
  status: number
  startedAt: number
  time: number
  mimeType: string
  requestBody?: RequestView["requestBody"]
  exchange: Exchange
  decoded?: DecodeResult
  getBody: () => Promise<Body>
}

export function toEntry(
  req: FinishedRequest,
  id: number,
  decoded?: DecodeResult,
): Entry {
  let body: Promise<Body> | undefined
  return {
    id,
    method: req.method,
    url: req.url,
    status: req.status,
    startedAt: Date.parse(req.startedDateTime),
    time: req.time,
    mimeType: req.mimeType,
    requestBody: req.requestBody,
    exchange: req.exchange,
    decoded,
    getBody: () => {
      body ??= req.fetchBody()
      return body
    },
  }
}
