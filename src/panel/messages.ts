import type { Message } from "../capture/entry"

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
