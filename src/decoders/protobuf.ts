import { binaryDecoder, hex, InvalidBytes, parseFirst } from "./bytes"

export const protobuf = binaryDecoder(
  "protobuf",
  [
    "application/x-protobuf",
    "application/protobuf",
    "application/vnd.google.protobuf",
  ],
  readMessage,
  "message",
)

export type ProtoMessage = { [field: string]: unknown }

export class Reader {
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

  // A little-endian view of the next size bytes.
  take(size: 4 | 8): DataView {
    if (this.offset + size > this.data.length) throw new Error("truncated")
    this.offset += size
    return new DataView(
      this.view.buffer,
      this.view.byteOffset + this.offset - size,
      size,
    )
  }

  fixed(size: 4 | 8) {
    const v = this.take(size)
    return size === 4
      ? { fixed32: v.getUint32(0, true), float: float32(v) }
      : { fixed64: int(v.getBigUint64(0, true)), double: v.getFloat64(0, true) }
  }
}

export const int = (n: bigint) =>
  Number.isSafeInteger(Number(n)) ? Number(n) : String(n)

export const float32 = (v: DataView) =>
  Number(v.getFloat32(0, true).toPrecision(7))

export function readMessage(data: Uint8Array): ProtoMessage {
  const message: ProtoMessage = {}
  eachField(data, (field, wireType, reader) => {
    const value = schemaLess(wireType, reader)
    const key = String(field)
    const prev = message[key]
    message[key] =
      prev === undefined
        ? value
        : Array.isArray(prev)
          ? [...prev, value]
          : [prev, value]
  })
  return message
}

// Validates each tag and blames bad values on their offset; read consumes the value.
export function eachField(
  data: Uint8Array,
  read: (field: number, wireType: number, reader: Reader) => void,
) {
  const reader = new Reader(data)
  while (!reader.done) {
    const tagAt = reader.offset
    const tag = guard(tagAt, () => Number(reader.varint()))
    if (!(tag >>> 3) || !values[tag & 7])
      throw new InvalidBytes("protobuf", tagAt)
    guard(reader.offset, () => read(tag >>> 3, tag & 7, reader))
  }
}

export function schemaLess(wireType: number, reader: Reader): unknown {
  return (values[wireType] as (reader: Reader) => unknown)(reader)
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
