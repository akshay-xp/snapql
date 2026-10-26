import { describe, expect, it } from "vitest"
import { requestPayload } from "./payload"

describe("requestPayload", () => {
  it("is absent without a body or with an empty one", () => {
    expect(requestPayload(undefined)).toBeUndefined()
    expect(requestPayload({ mimeType: "text/plain", text: "" })).toBeUndefined()
  })

  it("parses a URL-encoded form into fields", () => {
    expect(
      requestPayload({
        mimeType: "application/x-www-form-urlencoded;charset=UTF-8",
        text: "a=1&b=x+y",
      }),
    ).toEqual({
      form: [
        { name: "a", value: "1" },
        { name: "b", value: "x y" },
      ],
    })
  })

  it("formats any other body like a response body", () => {
    expect(
      requestPayload({ mimeType: "application/json", text: '{"a":1}' }),
    ).toEqual({ text: '{\n  "a": 1\n}', notes: [] })
  })
})
