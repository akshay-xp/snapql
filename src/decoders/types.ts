export type RequestView = {
  method: string
  url: string
  status: number
  requestBody?: { mimeType: string; text: string }
}

export type Decoded = { summary: string; data: unknown }

export type Decoder = {
  kind: string
  decode(req: RequestView): Decoded | undefined
}

export type DecodeResult = Decoded & { kind: string }
