export type Jwt = {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  expires?: string
}

export function decodeBase64(content: string): string {
  return new TextDecoder().decode(
    Uint8Array.from(atob(content), (c) => c.charCodeAt(0)),
  )
}

// Decoded for display only; the signature is never verified.
export function decodeJwt(value: string): Jwt | undefined {
  if (!/^[\w-]+\.[\w-]+\.[\w-]*$/.test(value)) return
  const [header, payload] = value.split(".", 2).map(segmentObject)
  if (typeof header?.alg !== "string" || !payload) return
  return typeof payload.exp === "number"
    ? { header, payload, expires: new Date(payload.exp * 1000).toISOString() }
    : { header, payload }
}

function segmentObject(segment: string): Record<string, unknown> | undefined {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/")
  try {
    const value = JSON.parse(
      decodeBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
    )
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value
      : undefined
  } catch {
    return undefined
  }
}
