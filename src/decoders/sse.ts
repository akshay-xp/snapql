import { baseMime } from "./text"
import type { Decoder } from "./types"

// Response-mime decoders: they only name streams no request decoder claims.
const byMime = (kind: string, mimes: string[]): Decoder => ({
  kind,
  decode(req) {
    if (!mimes.includes(baseMime(req.mimeType))) return
    return {
      title: new URL(req.url).pathname,
      detail: req.method,
      data: undefined,
    }
  },
})

export const sse = byMime("sse", ["text/event-stream"])
export const ndjson = byMime("ndjson", [
  "application/x-ndjson",
  "application/jsonl",
])
