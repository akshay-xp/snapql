import { parseJson } from "./json"
import type { Decoder } from "./types"
import { socketDecoder } from "./websocket"

// Engine.IO packet types, the first character of every text frame.
const engine: Record<string, string> = {
  "0": "open",
  "1": "close",
  "2": "ping",
  "3": "pong",
  "5": "upgrade",
  "6": "noop",
}

export const socketio: Decoder = {
  ...socketDecoder("socketio", (req) =>
    new URL(req.url).pathname.includes("/socket.io/"),
  ),
  decodeMessage(frame) {
    if (frame.bytes !== undefined) return
    const title = engine[frame.text[0]]
    if (!title) return
    const rest = frame.text.slice(1)
    const data = rest ? parseJson(rest) : undefined
    return {
      title,
      ...(rest && data === undefined && { detail: rest }),
      data,
    }
  },
}
