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
