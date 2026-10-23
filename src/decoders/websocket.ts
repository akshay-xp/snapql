import type { Decoder } from "./types"

// Socket entries come from the probe with method "WS".
export const websocket: Decoder = {
  kind: "websocket",
  decode(req) {
    if (req.method !== "WS") return
    const detail = req.protocols?.join(", ")
    return {
      title: new URL(req.url).pathname,
      ...(detail && { detail }),
      data: undefined,
    }
  },
}
