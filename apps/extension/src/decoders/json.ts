import { baseMime } from "./text"
import type { Decoder } from "./types"

const isJsonMime = (mimeType: string) => /(\/|\+)json$/.test(baseMime(mimeType))

export const json: Decoder = {
  kind: "json",
  decode(req) {
    const body = req.requestBody ? parseJson(req.requestBody.text) : undefined
    if (body === undefined && !isJsonMime(req.mimeType)) return
    // No data: Payload shows the body, so a breakdown would only repeat it.
    return {
      title: new URL(req.url).pathname,
      detail: req.method,
      data: undefined,
    }
  },
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
