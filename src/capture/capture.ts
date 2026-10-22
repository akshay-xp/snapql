import { decodeRequest } from "../decoders/registry"
import type { Decoder } from "../decoders/types"
import { type FinishedRequest, toEntry } from "./entry"
import type { Store } from "./store"

export type CaptureSource = {
  onRequestFinished(cb: (req: FinishedRequest) => void): () => void
  getHAR(): Promise<FinishedRequest[]>
}

const key = (req: FinishedRequest) => `${req.url} ${req.startedDateTime}`

export function startCapture(
  source: CaptureSource,
  store: Store,
  decoders: Decoder[],
): () => void {
  let id = 1
  const add = (req: FinishedRequest) =>
    store.add(toEntry(req, id++, decodeRequest(req, decoders)))
  // Live requests wait for the HAR read so backfilled ones keep their place, and
  // a request in both feeds is added once.
  let buffer: FinishedRequest[] | undefined = []
  const off = source.onRequestFinished((req) =>
    buffer ? buffer.push(req) : add(req),
  )
  source
    .getHAR()
    .catch(() => [])
    .then((har) => {
      const seen = new Set(har.map(key))
      har.forEach(add)
      buffer?.filter((req) => !seen.has(key(req))).forEach(add)
      buffer = undefined
    })
  return off
}
