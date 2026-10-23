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
  const of = (t: string) => requestBytes(t).map((b) => [...b])

  it("gives one UTF-8 candidate for ASCII and text above U+00FF", () => {
    expect(of("hi")).toEqual([[0x68, 0x69]])
    expect(of("é€")).toEqual([[0xc3, 0xa9, 0xe2, 0x82, 0xac]])
  })

  it("adds a Latin-1 candidate when the text could be either", () => {
    expect(of("é\x01")).toEqual([
      [0xc3, 0xa9, 0x01],
      [0xe9, 0x01],
    ])
    expect(of("\x00\xff\x80\x01")).toEqual([
      [0, 0xc3, 0xbf, 0xc2, 0x80, 1],
      [0, 0xff, 0x80, 1],
    ])
  })

  // Chrome would have decoded these bytes, so the text must have been UTF-8.
  it("drops the Latin-1 candidate when its bytes are valid UTF-8", () => {
    expect(of("\u00c3\u00a9")).toEqual([[0xc3, 0x83, 0xc2, 0xa9]])
  })
})
