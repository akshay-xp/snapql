import { parseJson } from "./json"
import type { Decoded, Decoder } from "./types"
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

// Socket.IO packet types, carried in Engine.IO "4" (message) frames.
const packets: Record<string, string> = {
  "0": "connect",
  "1": "disconnect",
  "2": "event",
  "3": "ack",
  "4": "connect_error",
  "5": "event",
  "6": "ack",
}

// <type>[<attachments>-][/<namespace>,][<ack id>][<JSON>]
function packet(text: string): Decoded | undefined {
  const name = packets[text[0]]
  if (!name) return
  const binary = text[0] === "5" || text[0] === "6"
  let rest = text.slice(1)
  if (binary) rest = rest.slice(rest.indexOf("-") + 1)
  let namespace = "/"
  if (rest[0] === "/") {
    const comma = rest.indexOf(",")
    namespace = comma === -1 ? rest : rest.slice(0, comma)
    rest = comma === -1 ? "" : rest.slice(comma + 1)
  }
  const digits = /^\d*/.exec(rest)?.[0] ?? ""
  const ack = digits ? Number(digits) : undefined
  const payload = parseJson(rest.slice(digits.length))
  const detail = [namespace === "/" ? "" : namespace, binary ? "binary" : ""]
    .filter(Boolean)
    .join(", ")
  const base = { ...(detail && { detail }) }
  const args = Array.isArray(payload) ? payload : []
  if (name === "event") {
    const [event, ...eventArgs] = args
    return {
      title: String(event),
      ...base,
      data: { args: eventArgs, ...(ack !== undefined && { ack }) },
    }
  }
  if (name === "ack") return { title: `ack ${ack}`, ...base, data: { args } }
  return { title: name, ...base, data: payload }
}

export const socketio: Decoder = {
  ...socketDecoder("socketio", (req) =>
    new URL(req.url).pathname.includes("/socket.io/"),
  ),
  decodeMessage(frame) {
    if (frame.bytes !== undefined) return
    if (frame.text[0] === "4") return packet(frame.text.slice(1))
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
