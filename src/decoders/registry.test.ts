import { describe, expect, it, vi } from "vitest"
import { decodeRequest } from "./registry"
import type { Decoder, RequestView } from "./types"

const req: RequestView = {
  method: "GET",
  url: "https://api.test/a",
  status: 200,
  mimeType: "",
}

const returnsUndefined: Decoder = { kind: "none", decode: () => undefined }
const throws: Decoder = {
  kind: "broken",
  decode: () => {
    throw new Error("bad input")
  },
}
const match = (kind: string): Decoder => ({
  kind,
  decode: vi.fn(() => ({ summary: `summary ${kind}`, data: kind })),
})

describe("decodeRequest", () => {
  it("returns the first match tagged with its kind", () => {
    const a = match("a")
    const b = match("b")

    expect(decodeRequest(req, [returnsUndefined, throws, a, b])).toEqual({
      kind: "a",
      summary: "summary a",
      data: "a",
    })
    expect(b.decode).not.toHaveBeenCalled()
  })

  it("returns undefined when no decoder matches", () => {
    expect(decodeRequest(req, [returnsUndefined, throws])).toBeUndefined()
  })
})
