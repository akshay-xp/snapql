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
// one code unit per byte, so the bytes can be rebuilt. Text that fits both
// (é + 01: C3 A9 01 or E9 01) is read as Latin-1, the likelier binary case.
export function requestBytes(body: string): Uint8Array {
  const utf8 = () => new TextEncoder().encode(body)
  if (/[\u0100-\uffff]/.test(body)) return utf8()
  const latin1 = Uint8Array.from(body, (c) => c.charCodeAt(0))
  return isUtf8(latin1) ? utf8() : latin1
}

function isUtf8(data: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data)
    return true
  } catch {
    return false
  }
}
