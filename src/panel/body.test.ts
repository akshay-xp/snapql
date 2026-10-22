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
})
