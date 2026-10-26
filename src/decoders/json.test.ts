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
  // No data: Payload shows the body, so a breakdown would only repeat it.
  it("matches a JSON request body, summarized by path, leaving the body to Payload", () => {
    expect(
      json.decode(
        req({
          method: "POST",
          url: "https://x/api/users?y=1",
          requestBody: body('{"a":1}'),
        }),
      ),
    ).toEqual({ title: "/api/users", detail: "POST", data: undefined })
  })

  it("matches a JSON response mime type", () => {
    expect(
      json.decode(req({ mimeType: "application/json; charset=utf-8" })),
    ).toEqual({ title: "/api/users/1", detail: "GET", data: undefined })
    expect(json.decode(req({ mimeType: "application/problem+json" }))).toEqual({
      title: "/api/users/1",
      detail: "GET",
      data: undefined,
    })
  })

  it("ignores requests that are not JSON either way", () => {
    expect(json.decode(req({ requestBody: body("a=1") }))).toBeUndefined()
    expect(json.decode(req({}))).toBeUndefined()
  })
})
