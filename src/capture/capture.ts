import { decodeRequest } from "../decoders/registry"
import type { Decoder } from "../decoders/types"
import { type FinishedRequest, toEntry } from "./entry"
import type { Store } from "./store"

export type CaptureSource = {
  onRequestFinished(cb: (req: FinishedRequest) => void): () => void
  getHAR(): Promise<FinishedRequest[]>
}

export function startCapture(
  source: CaptureSource,
  store: Store,
  decoders: Decoder[],
): () => void {
  let id = 1
  const add = (req: FinishedRequest) =>
    store.add(toEntry(req, id++, decodeRequest(req, decoders)))
  const off = source.onRequestFinished(add)
  source.getHAR().then((reqs) => reqs.forEach(add))
  return off
}
