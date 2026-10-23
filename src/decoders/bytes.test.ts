import { describe, expect, it } from "vitest"
import { bytes, text } from "./bytes"

describe("bytes", () => {
  it("decodes base64 bodies to their exact bytes", () => {
    expect(bytes({ content: "AP+AAQ==", encoding: "base64" })).toEqual(
      new Uint8Array([0, 255, 128, 1]),
    )
  })

  it("encodes text bodies as UTF-8", () => {
    expect(bytes({ content: "é", encoding: "" })).toEqual(
      new Uint8Array([0xc3, 0xa9]),
    )
  })
})

describe("text", () => {
  it("reads base64 bodies as UTF-8 and text bodies as is", () => {
    expect(text({ content: "w6k=", encoding: "base64" })).toBe("é")
    expect(text({ content: "hi", encoding: "" })).toBe("hi")
  })

  it("replaces invalid UTF-8", () => {
    expect(text({ content: "/w==", encoding: "base64" })).toBe("�")
  })
})
