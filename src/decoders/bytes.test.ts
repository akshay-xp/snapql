import { describe, expect, it } from "vitest"
import { bytes, requestBytes, text } from "./bytes"

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

describe("requestBytes", () => {
  const of = (t: string) => [...requestBytes(t)]

  it("encodes ASCII and text above U+00FF as UTF-8", () => {
    expect(of("hi")).toEqual([0x68, 0x69])
    expect(of("é€")).toEqual([0xc3, 0xa9, 0xe2, 0x82, 0xac])
  })

  it("reads text that can't be UTF-8 as one byte per code unit", () => {
    expect(of("\x00\xff\x80\x01\xc3\xa9")).toEqual([
      0, 0xff, 0x80, 1, 0xc3, 0xa9,
    ])
  })

  it("reads the ambiguous case as Latin-1", () => {
    expect(of("é\x01")).toEqual([0xe9, 0x01])
  })

  // Chrome would have decoded these bytes, so the text must have been UTF-8.
  it("encodes text whose Latin-1 bytes are valid UTF-8 as UTF-8", () => {
    expect(of("\u00c3\u00a9")).toEqual([0xc3, 0x83, 0xc2, 0xa9])
  })
})
