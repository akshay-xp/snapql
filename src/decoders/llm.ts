import { parseJson } from "./json"
import type { Decoder } from "./types"

type Body = Record<string, unknown>

const isObject = (v: unknown): v is Body =>
  typeof v === "object" && v !== null && !Array.isArray(v)

// Matched by body shape, not host, so proxies and self-hosted gateways match.
export const llm: Decoder = {
  kind: "llm",
  decode(req) {
    const body = req.requestBody && parseJson(req.requestBody.text)
    if (!isObject(body) || body.stream !== true) return
    if (typeof body.model !== "string") return
    if (!Array.isArray(body.messages) && !("input" in body)) return
    return { title: body.model, detail: "stream", data: body }
  },
}
