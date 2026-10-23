import type { Decoder, RequestView } from "./types"

// Socket entries come from the probe with method "WS". Protocol decoders reuse
// this for their kind and add decodeMessage.
export const socketDecoder = (
  kind: string,
  match: (req: RequestView) => boolean,
): Decoder => ({
  kind,
  decode(req) {
    if (req.method !== "WS" || !match(req)) return
    const detail = req.protocols?.join(", ")
    return {
      title: new URL(req.url).pathname,
      ...(detail && { detail }),
      data: undefined,
    }
  },
})

export const websocket = socketDecoder("websocket", () => true)
