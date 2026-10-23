import { hex } from "./bytes"

class Cursor {
  offset = 0
  private view: DataView

  constructor(private data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  }

  take(n: number): Uint8Array {
    if (this.offset + n > this.data.length) throw new RangeError("overrun")
    this.offset += n
    return this.data.subarray(this.offset - n, this.offset)
  }

  int(size: 1 | 2 | 4 | 8, signed = false): number | string {
    const at = this.offset
    this.take(size)
    const v = this.view
    if (size === 1) return signed ? v.getInt8(at) : v.getUint8(at)
    if (size === 2) return signed ? v.getInt16(at) : v.getUint16(at)
    if (size === 4) return signed ? v.getInt32(at) : v.getUint32(at)
    const n = signed ? v.getBigInt64(at) : v.getBigUint64(at)
    return Number.isSafeInteger(Number(n)) ? Number(n) : String(n)
  }

  float(size: 4 | 8): number {
    const at = this.offset
    this.take(size)
    return size === 4
      ? Number(this.view.getFloat32(at).toPrecision(7))
      : this.view.getFloat64(at)
  }

  text(n: number): string {
    return new TextDecoder().decode(this.take(n))
  }
}

export function readMsgpack(data: Uint8Array): unknown {
  return readValue(new Cursor(data))
}

function readValue(c: Cursor): unknown {
  const type = c.int(1) as number
  if (type < 0x80) return type
  if (type >= 0xe0) return type - 0x100
  if ((type & 0xe0) === 0xa0) return c.text(type & 0x1f)
  switch (type) {
    case 0xc0:
      return null
    case 0xc2:
      return false
    case 0xc3:
      return true
    case 0xc4:
      return hex(c.take(c.int(1) as number))
    case 0xca:
      return c.float(4)
    case 0xcb:
      return c.float(8)
    case 0xcc:
      return c.int(1)
    case 0xcd:
      return c.int(2)
    case 0xce:
      return c.int(4)
    case 0xcf:
      return c.int(8)
    case 0xd0:
      return c.int(1, true)
    case 0xd1:
      return c.int(2, true)
    case 0xd2:
      return c.int(4, true)
    case 0xd3:
      return c.int(8, true)
    case 0xd9:
      return c.text(c.int(1) as number)
    case 0xda:
      return c.text(c.int(2) as number)
    case 0xdb:
      return c.text(c.int(4) as number)
  }
  throw new RangeError(`unknown type ${type}`)
}
