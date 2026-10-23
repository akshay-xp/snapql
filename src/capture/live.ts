import { decodeRequest } from "../decoders/registry"
import { type StreamParser, streamParser } from "../decoders/stream"
import type { Decoder } from "../decoders/types"
import {
  appendMessages,
  type Body,
  type Entry,
  emptyExchange,
  FRAME_LIMIT,
  incoming,
  type Message,
} from "./entry"
import type { Drained, ProbeEvent } from "./probe-source"
import type { Store } from "./store"

type Stream = {
  entryId: number
  method: string
  url: string
  parser?: StreamParser
  raw: string
  claimed?: boolean
}

// Turns probe records into entries that grow while their stream is open.
export function createLive(
  store: Store,
  decoders: Decoder[],
  nextId: () => number,
) {
  const streams = new Map<string, Stream>()

  function open(key: string, ev: ProbeEvent & { type: "open" }) {
    const stream: Stream = {
      entryId: nextId(),
      method: ev.method,
      url: ev.url,
      parser: streamParser(ev.mimeType),
      raw: "",
    }
    streams.set(key, stream)
    const socket = ev.kind === "websocket"
    const req = {
      method: ev.method,
      url: ev.url,
      status: socket ? 101 : (ev.status ?? 200),
      protocols: ev.protocols,
      mimeType: ev.mimeType,
      requestBody:
        ev.body === undefined ? undefined : { mimeType: "", text: ev.body },
    }
    const entry: Entry = {
      ...req,
      id: stream.entryId,
      startedAt: ev.time,
      time: 0,
      exchange: emptyExchange,
      decoded: decodeRequest(req, decoders),
      // A fetch stream's body is the raw text so far; EventSource has none
      // until DevTools reports the finished request.
      getBody: () =>
        ev.kind === "fetch"
          ? Promise.resolve<Body>({ content: stream.raw, encoding: "" })
          : Promise.reject(new Error("available when the stream ends")),
      messages: [],
      open: true,
      ...(socket && { socket: { protocol: "" } }),
    }
    store.add(entry)
  }

  const append = (stream: Stream, msgs: Message[]) =>
    store.update(stream.entryId, (e) => appendMessages(e, msgs))

  return {
    // The earliest unclaimed live entry for this request, which the finished
    // request then fills in instead of adding a row.
    claim(req: { method: string; url: string }): number | undefined {
      for (const stream of streams.values()) {
        // Chrome reports a socket's handshake, after close, as a GET.
        const method = stream.method === "WS" ? "GET" : stream.method
        if (stream.claimed || method !== req.method) continue
        if (stream.url !== req.url) continue
        stream.claimed = true
        return stream.entryId
      }
    },
    // The page is gone, so its streams end without a close record.
    reset() {
      for (const { entryId } of streams.values())
        store.update(entryId, (e) => (e.open ? { ...e, open: false } : e))
      streams.clear()
    },
    apply({ session, events }: Drained) {
      for (const ev of events) {
        const key = `${session}:${ev.id}`
        if (ev.type === "open") {
          open(key, ev)
          continue
        }
        const stream = streams.get(key)
        if (!stream) continue
        if (ev.type === "chunk") {
          if (stream.raw.length < FRAME_LIMIT)
            stream.raw = (stream.raw + ev.text).slice(0, FRAME_LIMIT)
          append(stream, incoming(stream.parser?.push(ev.text) ?? [], ev.time))
        } else if (ev.type === "event") {
          const { text, event, lastId } = ev
          append(
            stream,
            incoming(
              [
                {
                  text,
                  ...(event !== undefined && { event }),
                  ...(lastId !== undefined && { id: lastId }),
                },
              ],
              ev.time,
            ),
          )
        } else if (ev.type === "ready") {
          const { protocol } = ev
          store.update(stream.entryId, (e) => ({
            ...e,
            socket: { ...e.socket, protocol },
          }))
        } else if (ev.type === "frame") {
          const { dir, time, text, bytes } = ev
          append(stream, [
            { dir, time, text, ...(bytes !== undefined && { bytes }) },
          ])
        } else {
          const tail = incoming(stream.parser?.end() ?? [], ev.time)
          const { code, reason } = ev
          store.update(stream.entryId, (e) => ({
            ...appendMessages(e, tail),
            open: false,
            ...(e.socket && {
              time: ev.time - e.startedAt,
              socket: { ...e.socket, closeCode: code, closeReason: reason },
            }),
          }))
        }
      }
    },
  }
}
