import type { Message } from "../capture/entry"
import type { Decoded } from "../decoders/types"

export function byteLabel(n: number): string {
  if (n < 1000) return `${n} B`
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)} kB`
  return `${(n / 1_000_000).toFixed(1)} MB`
}

export const messageBytes = (m: Pick<Message, "text" | "bytes">) =>
  m.bytes ?? new TextEncoder().encode(m.text).length

export const offsetLabel = (ms: number) => `+${(ms / 1000).toFixed(3)}s`

export const preview = (text: string) => text.replace(/\s+/g, " ").trim()

export const messageText = (m: Pick<Message, "text" | "bytes">) =>
  m.bytes === undefined ? preview(m.text) : `binary ${byteLabel(m.bytes)}`

export const arrow = (dir: Message["dir"]) => (dir === "out" ? "↑" : "↓")

// A protocol decoder's title stands in for the preview.
export const frameLabel = (
  m: Pick<Message, "text" | "bytes">,
  decoded?: Decoded,
): { text: string; detail?: string } =>
  decoded
    ? { text: decoded.title, ...(decoded.detail && { detail: decoded.detail }) }
    : { text: messageText(m) }

type Beat = Pick<Message, "text" | "bytes" | "event">

const beatEvents = new Set(["ping", "heartbeat"])
const beatTexts = new Set(["ping", "pong", "heartbeat"])

// Without a protocol decoder only exact keep-alive words count, so real
// messages are never hidden on a guess.
export const isHeartbeat = <M extends Beat>(
  m: M,
  decoderSays?: (m: M) => boolean,
) =>
  !!decoderSays?.(m) ||
  (m.event !== undefined && beatEvents.has(m.event)) ||
  (m.bytes === undefined && beatTexts.has(m.text.trim().toLowerCase()))
