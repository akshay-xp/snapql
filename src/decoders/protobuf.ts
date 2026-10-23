import { hex } from "./bytes"

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
    const tag = Number(reader.varint())
    const field = String(tag >>> 3)
    const value = readValue(reader, tag & 7)
    const prev = message[field]
    message[field] =
      prev === undefined
        ? value
        : Array.isArray(prev)
          ? [...prev, value]
          : [prev, value]
  }
  return message
}

function readValue(reader: Reader, wireType: number): unknown {
  if (wireType === 0) return int(BigInt.asIntN(64, reader.varint()))
  if (wireType === 5) return reader.fixed(4)
  if (wireType === 1) return reader.fixed(8)
  if (wireType === 2) return lengthDelimited(reader.bytes())
  throw new Error(`unsupported wire type ${wireType}`)
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
