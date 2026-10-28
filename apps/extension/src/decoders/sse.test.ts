import { describe, expect, it } from "vitest"
import { decoders } from "./index"
import { decodeRequest } from "./registry"
import { ndjson, sse } from "./sse"
import type { RequestView } from "./types"

function req(overrides: Partial<RequestView>): RequestView {
  return {
    method: "GET",
    url: "https://x/api/sse?a=1",
    status: 200,
    mimeType: "text/event-stream; charset=utf-8",
    ...overrides,
  }
}

describe("sse and ndjson", () => {
  it("match their stream mime types, titled by path", () => {
    expect(sse.decode(req({}))).toEqual({
      title: "/api/sse",
      detail: "GET",
      data: undefined,
    })
    for (const mimeType of ["application/x-ndjson", "application/jsonl"])
      expect(ndjson.decode(req({ mimeType }))?.title).toBe("/api/sse")
  })

  it("leave other mime types alone", () => {
    expect(sse.decode(req({ mimeType: "application/json" }))).toBeUndefined()
    expect(ndjson.decode(req({ mimeType: "application/json" }))).toBeUndefined()
  })

  it("come after specific decoders but before json", () => {
    const post = (text: string) =>
      decodeRequest(
        req({
          method: "POST",
          requestBody: { mimeType: "application/json", text },
        }),
        decoders,
      )?.kind
    expect(post('{"query":"subscription S { s }"}')).toBe("graphql")
    expect(post('{"a":1}')).toBe("sse")
  })
})
