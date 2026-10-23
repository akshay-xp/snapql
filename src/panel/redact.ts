import type { NameValue } from "../capture/entry"
import { parseJson } from "../decoders/json"
import type { Har, HarEntry } from "./har"
import { decodeJwt } from "./values"

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

// decodeJwt confirms each candidate, so dotted text like 127.0.0.1 survives.
const redactJwts = (text: string) =>
  text.replace(/[\w-]+\.[\w-]+\.[\w-]*/g, (m) => (decodeJwt(m) ? REDACTED : m))

const redactJson = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(redactJson)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value).map(([k, v]) => [
            k,
            secretName(k) ? REDACTED : redactJson(v),
          ]),
        )
      : value

function redactText(text: string, mimeType = ""): string {
  const json = parseJson(text)
  if (json && typeof json === "object")
    return redactJwts(JSON.stringify(redactJson(json)))
  if (mimeType.includes("x-www-form-urlencoded"))
    return redactJwts(redactSearch(text))
  return redactJwts(text)
}

const redactValues = (pairs: readonly NameValue[]) =>
  pairs.map((p) => ({ ...p, value: redactJwts(p.value) }))

// Cookie headers are always redacted, so the parsed lists must be too.
const redactCookies = (cookies: readonly NameValue[]) =>
  redactPairs(cookies, () => true)

function redactEntry(entry: HarEntry): HarEntry {
  const { request, response } = entry
  const { content } = response
  return {
    ...entry,
    request: {
      ...request,
      url: redactJwts(redactUrl(request.url)),
      headers: redactValues(redactPairs(request.headers, secretHeader)),
      cookies: redactCookies(request.cookies),
      queryString: redactValues(redactPairs(request.queryString, secretName)),
      ...(request.postData && {
        postData: {
          ...request.postData,
          text: redactText(request.postData.text, request.postData.mimeType),
        },
      }),
    },
    response: {
      ...response,
      headers: redactValues(redactPairs(response.headers, secretHeader)),
      cookies: redactCookies(response.cookies),
      content:
        content.text === undefined || content.encoding === "base64"
          ? content
          : { ...content, text: redactText(content.text, content.mimeType) },
    },
    ...(entry._webSocketMessages && {
      _webSocketMessages: entry._webSocketMessages.map((m) =>
        m.opcode === 1 ? { ...m, data: redactText(m.data) } : m,
      ),
    }),
  }
}

export const redactHar = (har: Har): Har => ({
  log: { ...har.log, entries: har.log.entries.map(redactEntry) },
})
