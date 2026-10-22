import { describe, expect, it } from "vitest"
import { json } from "./json"
import type { RequestView } from "./types"

function req(overrides: Partial<RequestView>): RequestView {
  return {
    method: "GET",
    url: "https://x/api/users/1",
    status: 200,
    mimeType: "text/html",
    ...overrides,
  }
}

const body = (text: string) => ({ mimeType: "application/json", text })

describe("json", () => {
  it("matches a JSON request body, summarized by path", () => {
    expect(
      json.decode(
        req({
          method: "POST",
          url: "https://x/api/users?y=1",
          requestBody: body('{"a":1}'),
        }),
      ),
    ).toEqual({ summary: "/api/users", data: { a: 1 } })
  })

  it("matches a JSON response mime type", () => {
    expect(
      json.decode(req({ mimeType: "application/json; charset=utf-8" })),
    ).toEqual({ summary: "/api/users/1", data: undefined })
    expect(json.decode(req({ mimeType: "application/problem+json" }))).toEqual({
      summary: "/api/users/1",
      data: undefined,
    })
  })

  it("ignores requests that are not JSON either way", () => {
    expect(json.decode(req({ requestBody: body("a=1") }))).toBeUndefined()
    expect(json.decode(req({}))).toBeUndefined()
  })
})
