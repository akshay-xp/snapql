import type { RequestView } from "../decoders/types"

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
  getBody: () => Promise<Body>
}

export function toEntry(req: FinishedRequest, id: number): Entry {
  let body: Promise<Body> | undefined
  return {
    id,
    method: req.method,
    url: req.url,
    status: req.status,
    startedAt: Date.parse(req.startedDateTime),
    time: req.time,
    getBody: () => {
      body ??= req.fetchBody()
      return body
    },
  }
}
