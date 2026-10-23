import { bytes, hex, requestBytes, text } from "./bytes"
import { protobufData } from "./protobuf"
import { baseMime } from "./text"
import type { Decoder, NameValue } from "./types"

const isGrpcWeb = (mime = "") =>
  /^application\/grpc-web(-text)?(\+proto)?$/.test(baseMime(mime))
const isText = (mime: string) =>
  baseMime(mime).startsWith("application/grpc-web-text")

export const grpcWeb: Decoder = {
  kind: "grpc-web",
  decode(req) {
    const body = req.requestBody
    if (!isGrpcWeb(body?.mimeType) && !isGrpcWeb(req.mimeType)) return
    const path = new URL(req.url).pathname
    const rpc = path.match(/^\/([^/]+\.[^/]+)\/([^/]+)$/)
    return {
      title: rpc ? rpc[2] : path,
      ...(rpc && { detail: rpc[1] }),
      data: body && requestData(body.mimeType, body.text),
    }
  },
  decodeResponse(body, _decoded, headers) {
    const textual = headers.some(
      (h) => h.name.toLowerCase() === "content-type" && isText(h.value),
    )
    let frames: Frame[]
    try {
      frames = readFrames(textual ? fromBase64Text(text(body)) : bytes(body))
    } catch {
      return { summary: "invalid framing", data: { hex: hex(bytes(body)) } }
    }
    const trailers = frames
      .filter((f) => f.trailers)
      .flatMap((f) => parseTrailers(f.data))
    // Trailers-only responses carry the status in the headers.
    const status = statusOf(
      trailers.length ? trailers : headers.map((h) => trailer(h.name, h.value)),
    )
    return {
      summary: status?.name ?? "no status",
      data: {
        ...messages(frames),
        ...(status && { status: status.text }),
        ...(trailers.length && { trailers }),
      },
    }
  },
}

function requestData(mime: string, text: string): unknown {
  const candidates = isText(mime) ? [fromBase64Text(text)] : requestBytes(text)
  for (const data of candidates) {
    try {
      return messages(readFrames(data))
    } catch {}
  }
  return { error: "invalid gRPC-web framing", hex: hex(candidates[0]) }
}

// grpc-web-text streams join separately padded chunks, so decode per 4 chars.
function fromBase64Text(text: string): Uint8Array {
  const groups = text.replace(/\s/g, "").match(/.{1,4}/g) ?? []
  return Uint8Array.from(groups.map(atob).join(""), (c) => c.charCodeAt(0))
}

function messages(frames: Frame[]): Record<string, unknown> {
  const data = frames.filter((f) => !f.trailers)
  return Object.fromEntries(
    data.map((f, i) => [
      data.length === 1 ? "message" : `message ${i + 1}`,
      f.compressed ? { compressed: hex(f.data) } : frameMessage(f.data),
    ]),
  )
}

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

function frameMessage(data: Uint8Array): unknown {
  const decoded = protobufData([data])
  return "message" in decoded ? decoded.message : decoded
}
