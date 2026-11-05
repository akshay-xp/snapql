import type { Decoder, RequestView } from "./types"

// Apps that can't set headers on a socket pass tokens as subprotocols; those
// fail this, so they never show as a protocol name.
export const isProtocolName = (value: string) =>
  /^[A-Za-z0-9._-]{1,40}$/.test(value)

// Socket entries come from the probe with method "WS". Protocol decoders reuse
// this for their kind and add decodeMessage.
export const socketDecoder = (
  kind: string,
  match: (req: RequestView) => boolean,
): Decoder => ({
  kind,
  decode(req) {
    if (req.method !== "WS" || !match(req)) return
    const detail = req.protocols?.filter(isProtocolName).join(", ")
    return {
      title: new URL(req.url).pathname,
      ...(detail && { detail }),
      data: undefined,
    }
  },
})

export const websocket = socketDecoder("websocket", () => true)
