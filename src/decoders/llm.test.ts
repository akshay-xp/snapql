import { describe, expect, it } from "vitest"
import { decoders } from "./index"
import { llm } from "./llm"
import { decodeRequest } from "./registry"
import type { RequestView } from "./types"

function post(text?: string): RequestView {
  return {
    method: "POST",
    url: "https://proxy.local/anything",
    status: 200,
    mimeType: "text/event-stream",
    ...(text !== undefined && {
      requestBody: { mimeType: "application/json", text },
    }),
  }
}

describe("llm.decode", () => {
  it("matches streaming chat and responses bodies, titled by model", () => {
    const body = { model: "gpt-4o", messages: [], stream: true }
    expect(llm.decode(post(JSON.stringify(body)))).toEqual({
      title: "gpt-4o",
      detail: "stream",
      data: body,
    })
    expect(
      llm.decode(post('{"model":"x","input":"hi","stream":true}'))?.title,
    ).toBe("x")
  })

  it("ignores other bodies", () => {
    for (const text of [
      '{"model":"m","messages":[],"stream":false}',
      '{"model":"m","messages":[]}',
      '{"model":1,"messages":[],"stream":true}',
      '{"model":"m","stream":true}',
      "not json",
      undefined,
    ])
      expect(llm.decode(post(text))).toBeUndefined()
  })

  it("comes before graphql", () => {
    expect(
      decodeRequest(
        post('{"model":"m","messages":[],"stream":true,"query":"q"}'),
        decoders,
      )?.kind,
    ).toBe("llm")
  })
})
