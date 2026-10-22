import type { DecodeResult, RequestView } from "../decoders/types"

export type Body = { content: string; encoding: string }

export type FinishedRequest = RequestView & {
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
    decoded,
    getBody: () => {
      body ??= req.fetchBody()
      return body
    },
  }
}
