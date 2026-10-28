import type { DecodeResult, Decoder, RequestView } from "./types"

// Bigger request bodies stay raw rows, so one huge upload can't stall capture.
export const DECODE_LIMIT = 1024 * 1024

export function decodeRequest(
  req: RequestView,
  decoders: Decoder[],
): DecodeResult | undefined {
  if ((req.requestBody?.text.length ?? 0) > DECODE_LIMIT) return
  for (const decoder of decoders) {
    try {
      const decoded = decoder.decode(req)
      if (decoded) return { kind: decoder.kind, ...decoded }
    } catch {
      // A broken decoder must not drop the request; treat it as no match.
    }
  }
}

export function decoderFor(
  kind: string,
  decoders: Decoder[],
): Decoder | undefined {
  return decoders.find((d) => d.kind === kind)
}
