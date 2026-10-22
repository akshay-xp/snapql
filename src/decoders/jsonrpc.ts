import { parseJson } from "./json"
import { count } from "./text"
import type { Decoder } from "./types"

type Call = { jsonrpc: "2.0"; method: string; params?: unknown }

const isCall = (v: unknown): v is Call =>
  typeof v === "object" &&
  v !== null &&
  (v as Call).jsonrpc === "2.0" &&
  typeof (v as Call).method === "string"

export const jsonrpc: Decoder = {
  kind: "jsonrpc",
  decode(req) {
    const data = req.requestBody && parseJson(req.requestBody.text)
    if (isCall(data))
      return {
        title: data.method,
        data: { method: data.method, params: data.params },
      }
    if (!Array.isArray(data) || !data.length || !data.every(isCall)) return
    return {
      title: data.map((c) => c.method).join(", "),
      detail: count(data.length, "call"),
      data: {
        calls: data.map((c) => ({
          name: c.method,
          value: c.params === undefined ? "" : JSON.stringify(c.params),
        })),
      },
    }
  },
}
