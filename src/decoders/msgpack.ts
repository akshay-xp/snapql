import { hex, InvalidBytes, keyText } from "./bytes"

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
  const c = new Cursor(data)
  const value = readValue(c)
  if (c.offset < data.length) throw new InvalidBytes("msgpack", c.offset)
  return value
}

// A value that runs past the end or has a reserved type blames its own start.
function readValue(c: Cursor): unknown {
  const start = c.offset
  try {
    return readItem(c)
  } catch (err) {
    throw err instanceof InvalidBytes ? err : new InvalidBytes("msgpack", start)
  }
}

function readItem(c: Cursor): unknown {
  const type = c.int(1) as number
  if (type < 0x80) return type
  if (type >= 0xe0) return type - 0x100
  if (type < 0x90) return readMap(c, type & 0x0f)
  if (type < 0xa0) return readArray(c, type & 0x0f)
  if (type < 0xc0) return c.text(type & 0x1f)
  switch (type) {
    case 0xc0:
      return null
    case 0xc2:
      return false
    case 0xc3:
      return true
    case 0xc4:
      return hex(c.take(c.int(1) as number))
    case 0xc5:
      return hex(c.take(c.int(2) as number))
    case 0xc6:
      return hex(c.take(c.int(4) as number))
    case 0xc7:
      return readExt(c, c.int(1) as number)
    case 0xc8:
      return readExt(c, c.int(2) as number)
    case 0xc9:
      return readExt(c, c.int(4) as number)
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
    case 0xd4:
    case 0xd5:
    case 0xd6:
    case 0xd7:
    case 0xd8:
      return readExt(c, 2 ** (type - 0xd4))
    case 0xd9:
      return c.text(c.int(1) as number)
    case 0xda:
      return c.text(c.int(2) as number)
    case 0xdb:
      return c.text(c.int(4) as number)
    case 0xdc:
      return readArray(c, c.int(2) as number)
    case 0xdd:
      return readArray(c, c.int(4) as number)
    case 0xde:
      return readMap(c, c.int(2) as number)
    case 0xdf:
      return readMap(c, c.int(4) as number)
  }
  throw new RangeError(`reserved type ${type}`)
}

function readArray(c: Cursor, n: number): unknown[] {
  return Array.from({ length: n }, () => readValue(c))
}

function readMap(c: Cursor, n: number): Record<string, unknown> {
  const map: Record<string, unknown> = {}
  for (let i = 0; i < n; i++) {
    const key = keyText(readValue(c))
    map[key] = readValue(c)
  }
  return map
}

function readExt(c: Cursor, size: number): unknown {
  const type = c.int(1, true) as number
  const data = c.take(size)
  return type === -1 ? timestamp(data) : { type, data: hex(data) }
}

function timestamp(data: Uint8Array): string {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let sec: number
  let ns = 0
  if (data.length === 4) sec = v.getUint32(0)
  else if (data.length === 8) {
    const n = v.getBigUint64(0)
    ns = Number(n >> 34n)
    sec = Number(n & 0x3ffffffffn)
  } else if (data.length === 12) {
    ns = v.getUint32(0)
    sec = Number(v.getBigInt64(4))
  } else throw new RangeError("bad timestamp")
  return new Date(sec * 1000 + Math.floor(ns / 1e6)).toISOString()
}
