import { parseJson } from "./json"
import type { Decoder } from "./types"

export const trpc: Decoder = {
  kind: "trpc",
  decode(req) {
    const url = new URL(req.url)
    const segments = url.pathname.split("/")
    const at = segments.indexOf("trpc")
    const path = at < 0 ? "" : decodeURIComponent(segments[at + 1] ?? "")
    if (!path) return
    const names = path.split(",")
    const text = req.requestBody?.text ?? url.searchParams.get("input")
    const input = text === null ? undefined : parseJson(text)
    const batch = url.searchParams.get("batch") === "1"
    const procedures = names.map((name, i) => {
      const value = batch
        ? (input as Record<string, unknown> | undefined)?.[String(i)]
        : input
      return { name, value: value === undefined ? "" : JSON.stringify(value) }
    })
    return { summary: names.join(", "), data: { procedures } }
  },
}
