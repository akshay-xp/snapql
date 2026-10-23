import { type Cursor, hex, keyText, readAll, readItemAt } from "./bytes"

const BREAK = Symbol("break")

export function readCbor(data: Uint8Array): unknown {
  return readAll(data, "cbor", (c) => readValue(c))
}

// Breaks are only valid inside indefinite-length items.
function readValue(c: Cursor, inIndefinite = false): unknown {
  return readItemAt(c, "cbor", () => {
    const value = readItem(c)
    if (value === BREAK && !inIndefinite) throw new RangeError("stray break")
    return value
  })
}

function readItem(c: Cursor): unknown {
  const initial = c.int(1) as number
  const major = initial >> 5
  const info = initial & 0x1f
  if (major === 7) return readSimple(c, info)
  const n = argument(c, info)
  switch (major) {
    case 0:
      return n
    case 1:
      return typeof n === "number" ? -1 - n : String(-1n - BigInt(n as string))
    case 2:
      return n === undefined ? chunks(c).join(" ") : hex(c.take(n as number))
    case 3:
      return n === undefined ? chunks(c).join("") : c.text(n as number)
    case 4:
      return n === undefined
        ? chunks(c)
        : Array.from({ length: n as number }, () => readValue(c))
    case 5:
      return readMap(c, n as number | undefined)
    default:
      return tagged(n as number, readValue(c))
  }
}

// Additional info: the value itself, a 1-8 byte argument, or indefinite.
function argument(c: Cursor, info: number): number | string | undefined {
  if (info < 24) return info
  if (info < 28) return c.int((2 ** (info - 24)) as 1 | 2 | 4 | 8)
  if (info === 31) return undefined
  throw new RangeError(`reserved info ${info}`)
}

function chunks(c: Cursor): unknown[] {
  const items: unknown[] = []
  for (;;) {
    const item = readValue(c, true)
    if (item === BREAK) return items
    items.push(item)
  }
}

function readMap(c: Cursor, n: number | undefined): Record<string, unknown> {
  const map: Record<string, unknown> = {}
  for (let i = 0; n === undefined || i < n; i++) {
    const key = readValue(c, n === undefined)
    if (key === BREAK) break
    map[keyText(key)] = readValue(c)
  }
  return map
}

function tagged(tag: number, value: unknown): unknown {
  if (tag === 0) return value
  if (tag === 1 && typeof value === "number")
    return new Date(value * 1000).toISOString()
  return { tag, value }
}

function readSimple(c: Cursor, info: number): unknown {
  switch (info) {
    case 20:
      return false
    case 21:
      return true
    case 22:
      return null
    case 23:
      return undefined
    case 24:
      return { simple: c.int(1) }
    case 25:
      return half(c.int(2) as number)
    case 26:
      return c.float(4)
    case 27:
      return c.float(8)
    case 31:
      return BREAK
  }
  if (info < 20) return { simple: info }
  throw new RangeError(`reserved simple ${info}`)
}

function half(h: number): number {
  const sign = h & 0x8000 ? -1 : 1
  const exp = (h >> 10) & 0x1f
  const mant = h & 0x3ff
  if (exp === 0) return sign * mant * 2 ** -24
  if (exp === 31) return mant ? Number.NaN : sign * Number.POSITIVE_INFINITY
  return sign * (mant + 1024) * 2 ** (exp - 25)
}
