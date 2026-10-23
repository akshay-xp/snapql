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

const block = (index: number, content_block: object) => ({
  type: "content_block_start",
  index,
  content_block,
})
const delta = (index: number, d: object) => ({
  type: "content_block_delta",
  index,
  delta: d,
})

const anthropicStream = events(
  {
    type: "message_start",
    message: {
      id: "msg_1",
      model: "claude-test",
      usage: { input_tokens: 10, output_tokens: 1 },
    },
  },
  block(0, { type: "thinking", thinking: "" }),
  delta(0, { type: "thinking_delta", thinking: "Let me " }),
  delta(0, { type: "thinking_delta", thinking: "think" }),
  { type: "content_block_stop", index: 0 },
  block(1, { type: "text", text: "" }),
  delta(1, { type: "text_delta", text: "Sure" }),
  block(2, { type: "tool_use", id: "toolu_1", name: "get_weather", input: {} }),
  delta(2, { type: "input_json_delta", partial_json: '{"city":' }),
  { type: "ping" },
  delta(2, { type: "input_json_delta", partial_json: '"Oslo"}' }),
  {
    type: "message_delta",
    delta: { stop_reason: "tool_use" },
    usage: { output_tokens: 20 },
  },
  { type: "message_stop" },
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

  it("folds OpenAI Responses events", () => {
    expect(
      reassemble(
        events(
          { type: "response.created", response: { status: "in_progress" } },
          { type: "response.output_text.delta", output_index: 0, delta: "Hi " },
          {
            type: "response.output_text.delta",
            output_index: 0,
            delta: "there",
          },
          {
            type: "response.output_item.added",
            output_index: 1,
            item: {
              type: "function_call",
              id: "fc_1",
              call_id: "call_9",
              name: "lookup",
              arguments: "",
            },
          },
          {
            type: "response.output_item.added",
            output_index: 2,
            item: { type: "message", id: "msg_1" },
          },
          {
            type: "response.function_call_arguments.delta",
            output_index: 1,
            delta: '{"q":',
          },
          {
            type: "response.function_call_arguments.delta",
            output_index: 1,
            delta: '"x"}',
          },
          {
            type: "response.completed",
            response: {
              status: "completed",
              usage: { input_tokens: 3, output_tokens: 4, total_tokens: 7 },
            },
          },
        ),
      ),
    ).toEqual({
      text: "Hi there",
      toolCalls: [{ id: "call_9", name: "lookup", arguments: '{"q":"x"}' }],
      stopReason: "completed",
      usage: { input_tokens: 3, output_tokens: 4, total_tokens: 7 },
    })
  })

  it("folds Anthropic content blocks, including thinking", () => {
    expect(reassemble(anthropicStream)).toEqual({
      text: "Sure",
      thinking: "Let me think",
      toolCalls: [
        { id: "toolu_1", name: "get_weather", arguments: '{"city":"Oslo"}' },
      ],
      stopReason: "tool_use",
      usage: { input_tokens: 10, output_tokens: 20 },
    })
    const noThinking = anthropicStream.filter((e) => !e.text.includes("think"))
    expect(reassemble(noThinking)).not.toHaveProperty("thinking")
  })
})

describe("llm.decodeResponse", () => {
  const sseBody = (stream: StreamEvent[]) =>
    stream.map((e) => `data: ${e.text}\n\n`).join("")
  const decoded = { kind: "llm", title: "m", data: {} }
  const decode = (text: string) =>
    llm.decodeResponse?.({ content: text, encoding: "" }, decoded)

  it("turns a reassembled reply into Summary sections", () => {
    const res = decode(sseBody(chatStream))
    expect(res?.summary).toBe("tool_calls")
    expect(Object.keys(res?.data as object)).toEqual([
      "reply",
      "tool get_weather",
      "tool get_time",
      "usage",
    ])
    expect(res?.data).toEqual({
      reply: "Hello",
      "tool get_weather": { id: "call_1", arguments: { city: "Paris" } },
      "tool get_time": { id: "call_2", arguments: {} },
      usage: [
        { name: "stop reason", value: "tool_calls" },
        { name: "prompt_tokens", value: "5" },
        { name: "completion_tokens", value: "7" },
        { name: "total_tokens", value: "12" },
      ],
    })
  })

  it("puts thinking after the reply", () => {
    const keys = Object.keys(decode(sseBody(anthropicStream))?.data as object)
    expect(keys.slice(0, 2)).toEqual(["reply", "thinking"])
  })

  it("keeps unparseable arguments as text and names repeated tools apart", () => {
    const res = decode(
      sseBody(
        events(
          chunk({
            tool_calls: [
              { index: 0, function: { name: "f", arguments: "{bad" } },
              { index: 1, function: { name: "f", arguments: "{}" } },
            ],
          }),
        ),
      ),
    )
    expect(res?.summary).toBe("incomplete")
    expect(res?.data).not.toHaveProperty("usage")
    expect(res?.data).toMatchObject({
      "tool f": { arguments: "{bad" },
      "tool f 2": { arguments: {} },
    })
  })

  it("gives undefined for other bodies", () => {
    expect(decode("data: hello\n\n")).toBeUndefined()
  })
})
