import { baseMime, count } from "./text"
import type { BodyView, Decoder } from "./types"

export function bytes(body: BodyView): Uint8Array {
  return body.encoding === "base64"
    ? Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(body.content)
}

export function text(body: BodyView): string {
  return body.encoding === "base64"
    ? new TextDecoder().decode(bytes(body))
    : body.content
}

// Chrome's HAR gives valid UTF-8 request bodies decoded and anything else as
// one code unit per byte. Text that fits both (é + 01: C3 A9 01 or E9 01) gets
// both candidates; binary decoders keep the first that parses. Latin-1 goes
// first: re-encoding binary as UTF-8 only adds bytes and often still parses,
// while reading UTF-8 as Latin-1 shrinks it and breaks length prefixes.
export function requestBytes(body: string): Uint8Array[] {
  const utf8 = new TextEncoder().encode(body)
  if (/[\u0100-\uffff]/.test(body) || utf8.length === body.length) return [utf8]
  const latin1 = Uint8Array.from(body, (c) => c.charCodeAt(0))
  return isUtf8(latin1) ? [utf8] : [latin1, utf8]
}

function isUtf8(data: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data)
    return true
  } catch {
    return false
  }
}

export function hex(data: Uint8Array): string {
  return Array.from(data, (b) => b.toString(16).padStart(2, "0")).join(" ")
}

export class InvalidBytes extends Error {
  constructor(
    format: string,
    readonly offset: number,
  ) {
    super(`invalid ${format} at byte ${offset}`)
  }
}

export function parseFirst<T>(
  candidates: Uint8Array[],
  read: (data: Uint8Array) => T,
): { value: T } | { error: string; hex: string } {
  let first: Error | undefined
  for (const data of candidates) {
    try {
      return { value: read(data) }
    } catch (err) {
      first ??= err as Error
    }
  }
  return { error: (first as Error).message, hex: hex(candidates[0]) }
}

// Tree keys must be strings; non-string map keys keep a readable form.
export function keyText(key: unknown): string {
  return typeof key === "string" ||
    typeof key === "number" ||
    typeof key === "boolean"
    ? String(key)
    : JSON.stringify(key)
}

// Big-endian reads; overruns throw RangeError for readItemAt to place.
export class Cursor {
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

// The whole input must be one value; leftovers blame the first unread byte.
export function readAll(
  data: Uint8Array,
  format: string,
  read: (c: Cursor) => unknown,
): unknown {
  const c = new Cursor(data)
  const value = read(c)
  if (c.offset < data.length) throw new InvalidBytes(format, c.offset)
  return value
}

// An item that runs past the end or is reserved blames its own start.
export function readItemAt<T>(
  c: Cursor,
  format: string,
  read: (c: Cursor) => T,
): T {
  const start = c.offset
  try {
    return read(c)
  } catch (err) {
    throw err instanceof InvalidBytes ? err : new InvalidBytes(format, start)
  }
}

// Binary formats matched by request or response mime; the value sits under key.
export function binaryDecoder(
  kind: string,
  mimes: string[],
  read: (data: Uint8Array) => unknown,
  key = "body",
): Decoder {
  const matches = (mime = "") => mimes.includes(baseMime(mime))
  const data = (candidates: Uint8Array[]) => {
    const parsed = parseFirst(candidates, read)
    return "value" in parsed ? { [key]: parsed.value } : parsed
  }
  return {
    kind,
    decode(req) {
      const body = req.requestBody
      if (!matches(body?.mimeType) && !matches(req.mimeType)) return
      return {
        title: new URL(req.url).pathname,
        detail: req.method,
        data: body && data(requestBytes(body.text)),
      }
    },
    decodeResponse(body) {
      const raw = bytes(body)
      return { summary: count(raw.length, "byte"), data: data([raw]) }
    },
  }
}
