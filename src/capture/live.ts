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

type Stream = { entryId: number; parser?: StreamParser; raw: string }

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
      parser: streamParser(ev.mimeType),
      raw: "",
    }
    streams.set(key, stream)
    const req = {
      method: ev.method,
      url: ev.url,
      status: ev.status ?? 200,
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
    }
    store.add(entry)
  }

  const append = (stream: Stream, msgs: Message[]) =>
    store.update(stream.entryId, (e) => appendMessages(e, msgs))

  return {
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
        } else {
          const tail = incoming(stream.parser?.end() ?? [], ev.time)
          store.update(stream.entryId, (e) => ({
            ...appendMessages(e, tail),
            open: false,
          }))
        }
      }
    },
  }
}
