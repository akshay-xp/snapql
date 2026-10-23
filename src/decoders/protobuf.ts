import { bytes, hex, InvalidBytes, parseFirst, requestBytes } from "./bytes"
import { baseMime } from "./text"
import type { Decoder } from "./types"

const MIMES = [
  "application/x-protobuf",
  "application/protobuf",
  "application/vnd.google.protobuf",
]
const isProtobuf = (mime = "") => MIMES.includes(baseMime(mime))

export const protobuf: Decoder = {
  kind: "protobuf",
  decode(req) {
    const body = req.requestBody
    if (!isProtobuf(body?.mimeType) && !isProtobuf(req.mimeType)) return
    return {
      title: new URL(req.url).pathname,
      detail: req.method,
      data: body && protobufData(requestBytes(body.text)),
    }
  },
  decodeResponse(body) {
    const data = bytes(body)
    return { summary: `${data.length} bytes`, data: protobufData([data]) }
  },
}

export type ProtoMessage = { [field: string]: unknown }

class Reader {
  offset = 0
  private view: DataView

  constructor(private data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  }

  get done() {
    return this.offset >= this.data.length
  }

  varint(): bigint {
    let value = 0n
    for (let shift = 0n; ; shift += 7n) {
      if (this.done) throw new Error("truncated varint")
      const byte = this.data[this.offset++]
      value |= BigInt(byte & 0x7f) << shift
      if (byte < 0x80) return value
    }
  }

  bytes(): Uint8Array {
    const length = Number(this.varint())
    if (this.offset + length > this.data.length) throw new Error("truncated")
    this.offset += length
    return this.data.subarray(this.offset - length, this.offset)
  }

  fixed(size: 4 | 8) {
    const at = this.offset
    this.offset += size
    return size === 4
      ? {
          fixed32: this.view.getUint32(at, true),
          float: Number(this.view.getFloat32(at, true).toPrecision(7)),
        }
      : {
          fixed64: int(this.view.getBigUint64(at, true)),
          double: this.view.getFloat64(at, true),
        }
  }
}

const int = (n: bigint) =>
  Number.isSafeInteger(Number(n)) ? Number(n) : String(n)

export function readMessage(data: Uint8Array): ProtoMessage {
  const reader = new Reader(data)
  const message: ProtoMessage = {}
  while (!reader.done) {
    const tagAt = reader.offset
    const tag = guard(tagAt, () => Number(reader.varint()))
    const read = values[tag & 7]
    if (!(tag >>> 3) || !read) throw new InvalidBytes("protobuf", tagAt)
    const value = guard(reader.offset, () => read(reader))
    const key = String(tag >>> 3)
    const prev = message[key]
    message[key] =
      prev === undefined
        ? value
        : Array.isArray(prev)
          ? [...prev, value]
          : [prev, value]
  }
  return message
}

function guard<T>(offset: number, read: () => T): T {
  try {
    return read()
  } catch {
    throw new InvalidBytes("protobuf", offset)
  }
}

// By wire type; groups (3, 4) are deprecated and unsupported.
const values: Partial<Record<number, (reader: Reader) => unknown>> = {
  0: (r) => int(BigInt.asIntN(64, r.varint())),
  1: (r) => r.fixed(8),
  2: (r) => lengthDelimited(r.bytes()),
  5: (r) => r.fixed(4),
}

export function protobufData(
  candidates: Uint8Array[],
): { message: ProtoMessage } | { error: string; hex: string } {
  const parsed = parseFirst(candidates, readMessage)
  return "value" in parsed ? { message: parsed.value } : parsed
}

const printable = /^[\t\n\r\P{Cc}]*$/u

// Strings before messages: printable bytes like "hi" also parse as a message,
// while real nested messages nearly always start with a control byte.
function lengthDelimited(data: Uint8Array): unknown {
  if (!data.length) return ""
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data)
    if (printable.test(text)) return text
  } catch {}
  try {
    return readMessage(data)
  } catch {
    return hex(data)
  }
}
