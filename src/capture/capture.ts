import { decodeRequest } from "../decoders/registry"
import type { Decoder } from "../decoders/types"
import { type FinishedRequest, toEntry } from "./entry"
import type { Store } from "./store"

export function startCapture(
  subscribe: (cb: (req: FinishedRequest) => void) => () => void,
  store: Store,
  decoders: Decoder[],
): () => void {
  let id = 1
  return subscribe((req) =>
    store.add(toEntry(req, id++, decodeRequest(req, decoders))),
  )
}
