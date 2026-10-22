import type { Exchange, NameValue } from "../capture/entry"
import { parseJson } from "../decoders/json"

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

export type Token = { source: string; jwt: Jwt }

export function findTokens(
  exchange: Pick<
    Exchange,
    "requestHeaders" | "requestCookies" | "responseCookies" | "queryString"
  >,
): Token[] {
  const candidates = [
    ...exchange.requestHeaders
      .filter((h) => h.name.toLowerCase() === "authorization")
      .map((h) => ({
        source: "Authorization header",
        value: h.value.match(/^bearer\s+(.+)$/i)?.[1] ?? "",
      })),
    ...labelled("cookie", exchange.requestCookies),
    ...labelled("set-cookie", exchange.responseCookies),
    ...labelled("query", exchange.queryString),
  ]
  return candidates.flatMap(({ source, value }) => {
    const jwt = decodeJwt(value)
    return jwt ? [{ source, jwt }] : []
  })
}

const labelled = (prefix: string, pairs: NameValue[]) =>
  pairs.map((p) => ({ source: `${prefix} ${p.name}`, value: p.value }))

export function decodeValue(value: string): string | undefined {
  const token = decodeJwt(value)
  if (token) return pretty(token.payload)
  let text = value
  try {
    text = decodeURIComponent(value)
  } catch {}
  const json = parseJson(text)
  if (typeof json === "object" && json !== null) return pretty(json)
  return text === value ? undefined : text
}

const pretty = (value: unknown) => JSON.stringify(value, null, 2)
