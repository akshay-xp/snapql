import type { Entry } from "../capture/entry"

type Request = Pick<Entry, "method" | "url" | "requestBody" | "exchange">

// Set by the browser or the transport, so replaying them would be wrong or rejected.
const DROPPED = new Set([
  "content-length",
  "accept-encoding",
  "connection",
  "host",
])

const keptHeaders = (req: Request) =>
  req.exchange.requestHeaders.filter(
    (h) => !h.name.startsWith(":") && !DROPPED.has(h.name.toLowerCase()),
  )

const quote = (s: string) => `'${s.replaceAll("'", "'\\''")}'`

export function toCurl(req: Request): string {
  const body = req.requestBody?.text
  const implied = body === undefined ? "GET" : "POST"
  return [
    `curl ${quote(req.url)}`,
    ...(req.method === implied ? [] : [`-X ${quote(req.method)}`]),
    ...keptHeaders(req).map((h) => `-H ${quote(`${h.name}: ${h.value}`)}`),
    ...(body === undefined ? [] : [`--data-raw ${quote(body)}`]),
  ].join(" \\\n  ")
}
