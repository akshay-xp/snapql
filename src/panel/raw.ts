import type { Entry, NameValue } from "../capture/entry"

const version = (entry: Pick<Entry, "exchange">) =>
  entry.exchange.httpVersion || "HTTP/1.1"

function message(startLine: string, headers: NameValue[], body?: string) {
  const head = [startLine, ...headers.map((h) => `${h.name}: ${h.value}`)]
  return body ? `${head.join("\n")}\n\n${body}` : head.join("\n")
}

export function rawRequest(
  entry: Pick<Entry, "method" | "url" | "requestBody" | "exchange">,
): string {
  const { pathname, search } = new URL(entry.url)
  return message(
    `${entry.method} ${pathname}${search} ${version(entry)}`,
    entry.exchange.requestHeaders,
    entry.requestBody?.text,
  )
}

export function rawResponse(
  entry: Pick<Entry, "status" | "exchange">,
  body: string,
): string {
  const line = [version(entry), entry.status, entry.exchange.statusText]
    .filter(Boolean)
    .join(" ")
  return message(line, entry.exchange.responseHeaders, body)
}
