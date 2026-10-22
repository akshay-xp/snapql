import type { Decoder } from "./types"

const isJsonMime = (mimeType: string) =>
  /(\/|\+)json$/.test(mimeType.split(";")[0].trim())

export const json: Decoder = {
  kind: "json",
  decode(req) {
    const data = req.requestBody ? parseJson(req.requestBody.text) : undefined
    if (data === undefined && !isJsonMime(req.mimeType)) return
    return { summary: new URL(req.url).pathname, data }
  },
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
