import type { StreamEvent } from "../decoders/stream"
import type {
  BodyView,
  DecodeResult,
  NameValue,
  RequestView,
} from "../decoders/types"

export type Body = BodyView

export type { NameValue }

// HAR phases in ms; -1 means the phase did not apply or was not reported.
export type Timings = {
  blocked: number
  dns: number
  connect: number
  ssl: number
  send: number
  wait: number
  receive: number
}

export type Exchange = {
  requestHeaders: NameValue[]
  responseHeaders: NameValue[]
  queryString: NameValue[]
  requestCookies: NameValue[]
  responseCookies: NameValue[]
  httpVersion: string
  statusText: string
  size: number
  timings: Timings
  fromCache?: "memory" | "disk"
}

export const emptyExchange: Exchange = {
  requestHeaders: [],
  responseHeaders: [],
  queryString: [],
  requestCookies: [],
  responseCookies: [],
  httpVersion: "",
  statusText: "",
  size: -1,
  timings: {
    blocked: -1,
    dns: -1,
    connect: -1,
    ssl: -1,
    send: -1,
    wait: -1,
    receive: -1,
  },
}

export type FinishedRequest = RequestView & {
  exchange: Exchange
  startedDateTime: string
  time: number
  fetchBody: () => Promise<Body>
}

// bytes and base64 are set for binary frames, whose text is "".
export type Message = {
  dir: "in" | "out"
  time: number
  text: string
  bytes?: number
  base64?: string
  event?: string
  id?: string
  truncated?: true
}

// Parsed stream events as incoming messages, all stamped with one arrival time.
export const incoming = (
  events: readonly StreamEvent[],
  time: number,
): Message[] => events.map((e) => ({ dir: "in", time, ...e }))

export const MESSAGE_CAP = 2000
export const FRAME_LIMIT = 1024 * 1024

export type Entry = {
  id: number
  method: string
  url: string
  status: number
  startedAt: number
  time: number
  mimeType: string
  requestBody?: RequestView["requestBody"]
  exchange: Exchange
  decoded?: DecodeResult
  getBody: () => Promise<Body>
  messages?: readonly Message[]
  open?: boolean
  droppedMessages?: number
  // WebSockets only.
  // protocol is the negotiated one; protocols were requested at creation.
  socket?: {
    protocol: string
    protocols?: string[]
    closeCode?: number
    closeReason?: string
  }
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
    mimeType: req.mimeType,
    requestBody: req.requestBody,
    exchange: req.exchange,
    decoded,
    getBody: () => {
      body ??= req.fetchBody()
      return body
    },
  }
}

export function appendMessages(entry: Entry, msgs: readonly Message[]): Entry {
  const all = [
    ...(entry.messages ?? []),
    ...msgs.map(
      (m): Message =>
        m.text.length > FRAME_LIMIT
          ? { ...m, text: m.text.slice(0, FRAME_LIMIT), truncated: true }
          : m,
    ),
  ]
  const dropped = all.length - MESSAGE_CAP
  if (dropped <= 0) return { ...entry, messages: all }
  return {
    ...entry,
    messages: all.slice(dropped),
    droppedMessages: (entry.droppedMessages ?? 0) + dropped,
  }
}
