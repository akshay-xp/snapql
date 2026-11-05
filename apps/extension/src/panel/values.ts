import type { Exchange, NameValue } from "../capture/entry"
import { text } from "../decoders/bytes"
import { parseJson } from "../decoders/json"

export type Jwt = {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  expires?: string
}

export function decodeBase64(content: string): string {
  return text({ content, encoding: "base64" })
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

const UNITS: [number, string][] = [
  [86_400_000, "d"],
  [3_600_000, "h"],
  [60_000, "min"],
  [1000, "s"],
]

const duration = (ms: number) => {
  const [size, unit] = UNITS.find(([size]) => ms >= size) ?? UNITS[3]
  return `${Math.round(ms / size)} ${unit}`
}

// Expiry is measured from the request, so it reads the same however long ago
// it was captured.
export type TokenFacts = {
  alg: string
  unsigned: boolean
  expiry?: { text: string; expired: boolean; iso: string }
}

export function tokenFacts(jwt: Jwt, startedAt: number): TokenFacts {
  const alg = String(jwt.header.alg)
  const facts = { alg, unsigned: alg.toLowerCase() === "none" }
  const { exp } = jwt.payload
  if (typeof exp !== "number" || !jwt.expires) return facts
  const gap = exp * 1000 - startedAt
  const expired = gap <= 0
  const text = expired
    ? `expired ${duration(-gap)} ago`
    : `expires in ${duration(gap)}`
  return { ...facts, expiry: { text, expired, iso: jwt.expires } }
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
