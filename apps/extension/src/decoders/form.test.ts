import { describe, expect, it } from "vitest"
import { form } from "./form"
import type { RequestView } from "./types"

function post(
  text?: string,
  mimeType = "application/x-www-form-urlencoded;charset=UTF-8",
): RequestView {
  return {
    method: "POST",
    url: "https://x/login",
    status: 200,
    mimeType: "text/html",
    requestBody: text === undefined ? undefined : { mimeType, text },
  }
}

describe("form", () => {
  // No data: Payload shows the fields, so a breakdown would only repeat them.
  it("counts fields, leaving the fields themselves to Payload", () => {
    expect(form.decode(post("a=1&b=x%20y"))).toEqual({
      title: "/login",
      detail: "2 fields",
      data: undefined,
    })
    expect(form.decode(post("c="))?.detail).toBe("1 field")
  })

  it("ignores other bodies", () => {
    expect(form.decode(post("a=1", "text/plain"))).toBeUndefined()
    expect(form.decode(post())).toBeUndefined()
  })
})
