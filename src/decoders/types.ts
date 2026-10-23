export type RequestView = {
  method: string
  url: string
  status: number
  // Response content type: metadata known at capture, not the response body.
  mimeType: string
  requestBody?: { mimeType: string; text: string }
  // WebSockets only: the protocols requested when the socket was created.
  protocols?: string[]
}

export type Decoded = { title: string; detail?: string; data: unknown }

export type DecodedResponse = { summary: string; data: unknown }

export type Decoder = {
  kind: string
  decode(req: RequestView): Decoded | undefined
  // Run lazily by the panel on the raw response text.
  decodeResponse?(
    text: string,
    decoded: DecodeResult,
  ): DecodedResponse | undefined
}

export type DecodeResult = Decoded & { kind: string }
