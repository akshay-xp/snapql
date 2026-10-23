import { describe, expect, it } from "vitest"
import { decoders } from "./index"
import { llm, reassemble } from "./llm"
import { decodeRequest } from "./registry"
import type { StreamEvent } from "./stream"
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

const events = (...payloads: unknown[]): StreamEvent[] =>
  payloads.map((p) => ({ text: typeof p === "string" ? p : JSON.stringify(p) }))

const chunk = (delta: object, finish_reason: string | null = null) => ({
  id: "chatcmpl-1",
  object: "chat.completion.chunk",
  choices: [{ index: 0, delta, finish_reason }],
})

const chatStream = events(
  chunk({ role: "assistant", content: "Hel" }),
  chunk({ content: "lo" }),
  chunk({
    tool_calls: [
      {
        index: 0,
        id: "call_1",
        type: "function",
        function: { name: "get_weather", arguments: "" },
      },
    ],
  }),
  chunk({ tool_calls: [{ index: 0, function: { arguments: '{"city"' } }] }),
  chunk({
    tool_calls: [
      {
        index: 1,
        id: "call_2",
        type: "function",
        function: { name: "get_time", arguments: "{}" },
      },
    ],
  }),
  chunk({ tool_calls: [{ index: 0, function: { arguments: ':"Paris"}' } }] }),
  chunk({}, "tool_calls"),
  {
    id: "chatcmpl-1",
    choices: [],
    usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
  },
  "[DONE]",
)

describe("reassemble", () => {
  it("folds Chat Completions deltas and merges tool calls by index", () => {
    expect(reassemble(chatStream)).toEqual({
      text: "Hello",
      toolCalls: [
        { id: "call_1", name: "get_weather", arguments: '{"city":"Paris"}' },
        { id: "call_2", name: "get_time", arguments: "{}" },
      ],
      stopReason: "tool_calls",
      usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
    })
  })

  it("gives undefined for unknown streams", () => {
    expect(reassemble(events("not json", { a: 1 }))).toBeUndefined()
    expect(reassemble([])).toBeUndefined()
  })
})
