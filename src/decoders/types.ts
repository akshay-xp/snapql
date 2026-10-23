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

export type NameValue = { name: string; value: string }

// A body as the browser reports it; encoding is "" or "base64".
export type BodyView = { content: string; encoding: string }

export type Decoded = { title: string; detail?: string; data: unknown }

export type DecodedResponse = { summary: string; data: unknown }

// A socket frame or stream message, as the panel holds it.
export type FrameView = { dir: "in" | "out"; text: string; bytes?: number }

export type Decoder = {
  kind: string
  decode(req: RequestView): Decoded | undefined
  // Run lazily by the panel on the raw response body.
  decodeResponse?(
    body: BodyView,
    decoded: DecodeResult,
  ): DecodedResponse | undefined
  // Run lazily by the panel for each visible frame; frames is the whole list,
  // for protocols whose frames refer to earlier ones.
  decodeMessage?(
    frame: FrameView,
    frames: readonly FrameView[],
  ): Decoded | undefined
}

export type DecodeResult = Decoded & { kind: string }
