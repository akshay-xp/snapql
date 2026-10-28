import { requestLabel } from "./graphql"
import { parseJson } from "./json"
import type { Decoder } from "./types"
import { socketDecoder } from "./websocket"

// graphql-transport-ws (graphql-ws library) and the legacy graphql-ws
// subprotocol (subscriptions-transport-ws).
const PROTOCOLS = ["graphql-transport-ws", "graphql-ws"]

const control = new Set([
  "connection_init",
  "connection_ack",
  "connection_error",
  "connection_terminate",
  "ping",
  "pong",
  "ka",
])

const operation = new Set(["subscribe", "start"])
// Frames that carry the id of an earlier subscribe/start.
const result = new Set(["next", "data", "error", "complete", "stop"])

type Message = { type?: unknown; id?: unknown; payload?: unknown }

const parse = (text: string) => parseJson(text) as Message | undefined

const operationName = (payload: unknown) =>
  requestLabel(payload)?.title ?? "anonymous"

export const graphqlWs: Decoder = {
  ...socketDecoder("graphql-ws", (req) =>
    PROTOCOLS.some((p) => req.protocols?.includes(p)),
  ),
  decodeMessage(frame, frames) {
    const message = parse(frame.text)
    const type = message?.type
    if (typeof type !== "string") return
    const data = message?.payload
    if (control.has(type)) return { title: type, data }
    if (operation.has(type))
      return { title: operationName(data), detail: type, data }
    if (!result.has(type)) return
    const id = message?.id
    const started = [...frames].reverse().find((f) => {
      const m = parse(f.text)
      return m?.id === id && operation.has(String(m?.type))
    })
    return {
      title: started ? operationName(parse(started.text)?.payload) : String(id),
      detail: type,
      data,
    }
  },
}
