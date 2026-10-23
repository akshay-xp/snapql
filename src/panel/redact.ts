import type { NameValue } from "../capture/entry"
import type { Har, HarEntry } from "./har"

const REDACTED = "[redacted]"
const SECRET = /token|secret|key|auth|session|csrf|password/i
const ALWAYS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
])

const secretName = (name: string) => SECRET.test(name)
// Pseudo-headers skip the name rule: ":authority" would match "auth".
const secretHeader = (name: string) =>
  ALWAYS.has(name.toLowerCase()) || (!name.startsWith(":") && secretName(name))

const redactPairs = (
  pairs: readonly NameValue[],
  secret: (name: string) => boolean,
): NameValue[] =>
  pairs.map((p) => (secret(p.name) ? { ...p, value: REDACTED } : p))

// Pair by pair on the raw text, so untouched params keep their encoding.
function redactSearch(raw: string): string {
  return raw
    .split("&")
    .map((pair) => {
      const at = pair.indexOf("=")
      if (at === -1) return pair
      const name = pair.slice(0, at)
      return secretName(safeDecode(name)) ? `${name}=${REDACTED}` : pair
    })
    .join("&")
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text.replaceAll("+", " "))
  } catch {
    return text
  }
}

function redactUrl(url: string): string {
  const at = url.indexOf("?")
  if (at === -1) return url
  const hash = url.indexOf("#", at)
  const end = hash === -1 ? url.length : hash
  return (
    url.slice(0, at + 1) + redactSearch(url.slice(at + 1, end)) + url.slice(end)
  )
}

// Cookie headers are always redacted, so the parsed lists must be too.
const redactCookies = (cookies: readonly NameValue[]) =>
  redactPairs(cookies, () => true)

function redactEntry(entry: HarEntry): HarEntry {
  const { request, response } = entry
  return {
    ...entry,
    request: {
      ...request,
      url: redactUrl(request.url),
      headers: redactPairs(request.headers, secretHeader),
      cookies: redactCookies(request.cookies),
      queryString: redactPairs(request.queryString, secretName),
    },
    response: {
      ...response,
      headers: redactPairs(response.headers, secretHeader),
      cookies: redactCookies(response.cookies),
    },
  }
}

export const redactHar = (har: Har): Har => ({
  log: { ...har.log, entries: har.log.entries.map(redactEntry) },
})
