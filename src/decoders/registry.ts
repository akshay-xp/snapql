import type { DecodeResult, Decoder, RequestView } from "./types"

export function decodeRequest(
  req: RequestView,
  decoders: Decoder[],
): DecodeResult | undefined {
  for (const decoder of decoders) {
    try {
      const decoded = decoder.decode(req)
      if (decoded) return { kind: decoder.kind, ...decoded }
    } catch {
      // A broken decoder must not drop the request; treat it as no match.
    }
  }
}
