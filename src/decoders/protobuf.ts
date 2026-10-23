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
      const byte = this.data[this.offset++]
      value |= BigInt(byte & 0x7f) << shift
      if (byte < 0x80) return value
    }
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
  throw new Error(`unsupported wire type ${wireType}`)
}
