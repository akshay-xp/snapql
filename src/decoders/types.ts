export type RequestView = {
  method: string
  url: string
  status: number
  // Response content type: metadata known at capture, not the response body.
  mimeType: string
  requestBody?: { mimeType: string; text: string }
}

export type Decoded = { summary: string; data: unknown }

export type Decoder = {
  kind: string
  decode(req: RequestView): Decoded | undefined
}

export type DecodeResult = Decoded & { kind: string }
