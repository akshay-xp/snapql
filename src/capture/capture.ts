import { type FinishedRequest, toEntry } from "./entry"
import type { Store } from "./store"

export function startCapture(
  subscribe: (cb: (req: FinishedRequest) => void) => () => void,
  store: Store,
): () => void {
  let id = 1
  return subscribe((req) => store.add(toEntry(req, id++)))
}
