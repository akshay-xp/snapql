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

type Message = { type?: unknown; id?: unknown; payload?: unknown }

export const graphqlWs: Decoder = {
  ...socketDecoder("graphql-ws", (req) =>
    PROTOCOLS.some((p) => req.protocols?.includes(p)),
  ),
  decodeMessage(frame) {
    const message = parseJson(frame.text) as Message | undefined
    const type = message?.type
    if (typeof type !== "string" || !control.has(type)) return
    return { title: type, data: message?.payload }
  },
}
