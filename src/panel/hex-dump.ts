import { hex } from "../decoders/bytes"
import { count } from "../decoders/text"

// Offset, 16 hex bytes and their printable ASCII per line; capped at limit bytes.
export function hexDump(data: Uint8Array, limit = 65536): string {
  const lines: string[] = []
  for (let at = 0; at < Math.min(data.length, limit); at += 16) {
    const row = data.subarray(at, Math.min(at + 16, limit))
    const ascii = Array.from(row, (b) =>
      b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".",
    )
    lines.push(
      `${at.toString(16).padStart(8, "0")}  ${hex(row).padEnd(47)}  |${ascii.join("")}|`,
    )
  }
  if (data.length > limit)
    lines.push(`… ${count(data.length - limit, "more byte")}`)
  return lines.join("\n")
}
