import { describe, expect, it } from "vitest"
import { emptyExchange } from "../capture/test-helpers"
import { rawRequest, rawResponse } from "./raw"

const exchange = (overrides: Partial<typeof emptyExchange>) => ({
  ...emptyExchange,
  httpVersion: "HTTP/1.1",
  ...overrides,
})

describe("rawRequest", () => {
  const post = {
    method: "POST",
    url: "https://x/graphql?a=1",
    exchange: exchange({
      requestHeaders: [{ name: "content-type", value: "application/json" }],
    }),
  }

  it("renders request line, headers and body", () => {
    expect(
      rawRequest({ ...post, requestBody: { mimeType: "", text: "{}" } }),
    ).toBe("POST /graphql?a=1 HTTP/1.1\ncontent-type: application/json\n\n{}")
  })

  it("omits the body section without a body", () => {
    expect(rawRequest(post)).toBe(
      "POST /graphql?a=1 HTTP/1.1\ncontent-type: application/json",
    )
  })

  it("falls back to HTTP/1.1 without a version", () => {
    expect(
      rawRequest({ method: "GET", url: "https://x/", exchange: emptyExchange }),
    ).toBe("GET / HTTP/1.1")
  })
})

describe("rawResponse", () => {
  it("renders status line, headers and body", () => {
    expect(
      rawResponse(
        {
          status: 200,
          exchange: exchange({
            statusText: "OK",
            responseHeaders: [{ name: "x", value: "1" }],
          }),
        },
        "ok",
      ),
    ).toBe("HTTP/1.1 200 OK\nx: 1\n\nok")
  })
})
