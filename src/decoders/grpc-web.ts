import type { NameValue } from "./types"

export type Frame = { trailers: boolean; compressed: boolean; data: Uint8Array }

// Each frame: 1 flag byte (0x80 trailers, 0x01 compressed), 4-byte big-endian length.
export function readFrames(body: Uint8Array): Frame[] {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
  const frames: Frame[] = []
  for (let at = 0; at < body.length; ) {
    const flag = view.getUint8(at)
    const end = at + 5 + view.getUint32(at + 1)
    if (end > body.length) throw new RangeError("frame runs past the end")
    frames.push({
      trailers: (flag & 0x80) !== 0,
      compressed: (flag & 1) !== 0,
      data: body.subarray(at + 5, end),
    })
    at = end
  }
  return frames
}

const STATUS = [
  "OK",
  "CANCELLED",
  "UNKNOWN",
  "INVALID_ARGUMENT",
  "DEADLINE_EXCEEDED",
  "NOT_FOUND",
  "ALREADY_EXISTS",
  "PERMISSION_DENIED",
  "RESOURCE_EXHAUSTED",
  "FAILED_PRECONDITION",
  "ABORTED",
  "OUT_OF_RANGE",
  "UNIMPLEMENTED",
  "INTERNAL",
  "UNAVAILABLE",
  "DATA_LOSS",
  "UNAUTHENTICATED",
]

export function parseTrailers(data: Uint8Array): NameValue[] {
  return new TextDecoder()
    .decode(data)
    .split(/\r?\n/)
    .filter((line) => line.includes(":"))
    .map((line) => {
      const i = line.indexOf(":")
      return trailer(line.slice(0, i), line.slice(i + 1))
    })
}

// grpc-message is percent-encoded on the wire.
function trailer(name: string, value: string): NameValue {
  name = name.trim().toLowerCase()
  value = value.trim()
  if (name === "grpc-message") {
    try {
      value = decodeURIComponent(value)
    } catch {}
  }
  return { name, value }
}

export function statusOf(
  rows: readonly NameValue[],
): { name: string; text: string } | undefined {
  const get = (name: string) => rows.find((r) => r.name === name)?.value
  const code = get("grpc-status")
  if (code === undefined) return
  const name = STATUS[Number(code)] ?? `CODE ${code}`
  const message = get("grpc-message")
  return { name, text: message ? `${name}: ${message}` : name }
}
