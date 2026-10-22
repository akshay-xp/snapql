import { baseMime } from "./text"
import type { Decoder } from "./types"

const isJsonMime = (mimeType: string) => /(\/|\+)json$/.test(baseMime(mimeType))

export const json: Decoder = {
  kind: "json",
  decode(req) {
    const data = req.requestBody ? parseJson(req.requestBody.text) : undefined
    if (data === undefined && !isJsonMime(req.mimeType)) return
    return { title: new URL(req.url).pathname, detail: req.method, data }
  },
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
