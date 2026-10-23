import { decodeRequest } from "../decoders/registry"
import type { Decoder } from "../decoders/types"
import { type FinishedRequest, toEntry } from "./entry"
import { createLive } from "./live"
import type { Drained } from "./probe-source"
import type { Store } from "./store"

export type CaptureSource = {
  onRequestFinished(cb: (req: FinishedRequest) => void): () => void
  getHAR(): Promise<FinishedRequest[]>
  onNavigated(cb: () => void): () => void
  // Live stream records from the page probe; absent where there is no probe.
  onProbe?(cb: (drained: Drained) => void): () => void
}

const key = (req: FinishedRequest) => `${req.url} ${req.startedDateTime}`

export function startCapture(
  source: CaptureSource,
  store: Store,
  decoders: Decoder[],
  preserveLog: () => boolean,
): () => void {
  let id = 1
  const live = createLive(store, decoders, () => id++)
  const add = (req: FinishedRequest) => {
    const liveId = live.claim(req)
    if (liveId === undefined)
      return store.add(toEntry(req, id++, decodeRequest(req, decoders)))
    // Keeps the live entry's id, decode result and messages.
    store.update(liveId, (e) => ({
      ...toEntry(req, e.id, e.decoded),
      messages: e.messages,
      droppedMessages: e.droppedMessages,
      open: false,
    }))
  }
  // Live requests wait for the HAR read so backfilled ones keep their place.
  // Chrome also delivers already-finished requests live after the HAR read, so
  // a live request matching a HAR entry is dropped; a request finishes once,
  // so its key is forgotten on first match.
  let buffer: FinishedRequest[] | undefined = []
  let fromHAR = new Set<string>()
  const addLive = (req: FinishedRequest) => {
    if (!fromHAR.delete(key(req))) add(req)
  }
  const off = source.onRequestFinished((req) =>
    buffer ? buffer.push(req) : addLive(req),
  )
  source
    .getHAR()
    .catch(() => [])
    .then((har) => {
      fromHAR = new Set(har.map(key))
      har.forEach(add)
      buffer?.forEach(addLive)
      buffer = undefined
    })
  const offProbe = source.onProbe?.(live.apply)
  const offNavigated = source.onNavigated(() => {
    live.reset()
    if (!preserveLog()) store.clear()
  })
  return () => {
    off()
    offNavigated()
    offProbe?.()
  }
}
