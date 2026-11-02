import type { Entry, NameValue } from "../capture/entry"

const header = (list: NameValue[], name: string) =>
  list.find((h) => h.name.toLowerCase() === name)?.value

// A CORS request names its origin; one blocked at preflight only carries
// provisional headers, where Referer still does.
function requesterOrigin(headers: NameValue[]): string | undefined {
  const origin = header(headers, "origin")
  if (origin) return origin
  const referer = header(headers, "referer")
  return referer && URL.canParse(referer) ? new URL(referer).origin : undefined
}

// Chrome tells extensions only net::ERR_FAILED for a CORS block, so CORS is
// inferred from a cross-origin request the response did not allow.
function corsLabel(entry: Pick<Entry, "url" | "exchange">): string | undefined {
  const { requestHeaders, responseHeaders } = entry.exchange
  const origin = requesterOrigin(requestHeaders)
  if (!origin || origin === new URL(entry.url).origin) return
  if (!responseHeaders.length) return "probably CORS"
  const allowed = header(responseHeaders, "access-control-allow-origin")
  if (allowed !== "*" && allowed !== origin) return "CORS error"
}

export function failureOf(
  entry: Pick<Entry, "url" | "status" | "exchange">,
): string | undefined {
  const { error } = entry.exchange
  if (error)
    return (
      (error === "net::ERR_FAILED" && corsLabel(entry)) ||
      error.replace(/^net::/, "")
    )
  if (entry.status === 0) return "failed"
  if (entry.status >= 400) return String(entry.status)
}
