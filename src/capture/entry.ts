export type Body = { content: string; encoding: string }

export type FinishedRequest = {
  method: string
  url: string
  status: number
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
  return {
    id,
    method: req.method,
    url: req.url,
    status: req.status,
    startedAt: Date.parse(req.startedDateTime),
    time: req.time,
    getBody: req.fetchBody,
  }
}
