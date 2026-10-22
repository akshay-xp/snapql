import { describe, expect, it } from "vitest"
import { formatBody } from "./body"

const text = (content: string) => ({ content, encoding: "" })

describe("formatBody", () => {
  it("pretty-prints anything that parses as JSON", () => {
    expect(formatBody(text('{"a":1}'))).toEqual({
      text: '{\n  "a": 1\n}',
      notes: [],
    })
  })

  it("passes other text through", () => {
    expect(formatBody(text("hello"))).toEqual({ text: "hello", notes: [] })
    expect(formatBody(text("{bad"))).toEqual({ text: "{bad", notes: [] })
  })

  it("describes base64 bodies with their decoded size", () => {
    const base64 = (content: string) => ({ content, encoding: "base64" })

    expect(formatBody(base64("aGVsbG8="))).toEqual({
      text: "aGVsbG8=",
      notes: ["base64-encoded, 5 bytes"],
    })
    expect(formatBody(base64("aGk=")).notes).toEqual([
      "base64-encoded, 2 bytes",
    ])
    expect(formatBody(base64("aGVsbG8hIQ==")).notes).toEqual([
      "base64-encoded, 7 bytes",
    ])
  })
})
