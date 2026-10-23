import type { BodyView } from "./types"

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
