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
  it("counts and decodes fields", () => {
    expect(form.decode(post("a=1&b=x%20y"))).toEqual({
      title: "/login",
      detail: "2 fields",
      data: {
        fields: [
          { name: "a", value: "1" },
          { name: "b", value: "x y" },
        ],
      },
    })
  })

  it("uses the singular and decodes plus as space", () => {
    expect(form.decode(post("c="))?.detail).toBe("1 field")
    expect(form.decode(post("q=a+b"))?.data).toEqual({
      fields: [{ name: "q", value: "a b" }],
    })
  })

  it("ignores other bodies", () => {
    expect(form.decode(post("a=1", "text/plain"))).toBeUndefined()
    expect(form.decode(post())).toBeUndefined()
  })
})
