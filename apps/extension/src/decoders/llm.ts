import { text as bodyText } from "./bytes"
import { parseJson } from "./json"
import { parseStream, type StreamEvent } from "./stream"
import type { Decoder } from "./types"

type Body = Record<string, unknown>

const isObject = (v: unknown): v is Body =>
  typeof v === "object" && v !== null && !Array.isArray(v)

// Matched by body shape, not host, so proxies and self-hosted gateways match.
export const llm: Decoder = {
  kind: "llm",
  decode(req) {
    const body = req.requestBody && parseJson(req.requestBody.text)
    if (!isObject(body) || body.stream !== true) return
    if (typeof body.model !== "string") return
    if (!Array.isArray(body.messages) && !("input" in body)) return
    // No data: Payload shows the body, so a breakdown would only repeat it.
    return { title: body.model, detail: "stream", data: undefined }
  },
  decodeResponse(body) {
    const reply = reassemble(
      parseStream("text/event-stream", bodyText(body)) ?? [],
    )
    return (
      reply && {
        summary: reply.stopReason ?? "incomplete",
        data: replyData(reply),
      }
    )
  },
}

// Section order: reply, thinking, one section per tool call, then usage rows.
function replyData(reply: Reassembled): Body {
  const data: Body = { reply: reply.text }
  if (reply.thinking) data.thinking = reply.thinking
  for (const call of reply.toolCalls) {
    let key = `tool ${call.name}`
    for (let n = 2; key in data; n++) key = `tool ${call.name} ${n}`
    const args = parseJson(call.arguments)
    data[key] = {
      ...(call.id && { id: call.id }),
      arguments: args === undefined ? call.arguments : args,
    }
  }
  const usage = [
    ...(reply.stopReason
      ? [{ name: "stop reason", value: reply.stopReason }]
      : []),
    ...Object.entries(reply.usage ?? {}).map(([name, v]) => ({
      name,
      value: typeof v === "string" ? v : JSON.stringify(v),
    })),
  ]
  if (usage.length) data.usage = usage
  return data
}

export type ToolCall = { id?: string; name: string; arguments: string }

export type Reassembled = {
  text: string
  thinking?: string
  toolCalls: ToolCall[]
  stopReason?: string
  usage?: Record<string, unknown>
}

type Folder = { fold(payload: Body): void; result(): Reassembled }

const obj = (v: unknown): Body => (isObject(v) ? v : {})
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined

// The first payload of a known format picks the folder; unknown streams give undefined.
export function reassemble(events: StreamEvent[]): Reassembled | undefined {
  let folder: Folder | undefined
  for (const event of events) {
    const payload = parseJson(event.text)
    if (!isObject(payload)) continue
    folder ??= folderFor(payload)
    folder?.fold(payload)
  }
  return folder?.result()
}

function folderFor(payload: Body): Folder | undefined {
  if (Array.isArray(payload.choices)) return chatCompletions()
  if (str(payload.type)?.startsWith("response.")) return responses()
  if (
    payload.type === "message_start" ||
    str(payload.type)?.startsWith("content_block_")
  )
    return anthropic()
}

// Tool calls arrive as fragments keyed by index: id and name once, arguments in pieces.
function toolCalls() {
  const calls = new Map<number, ToolCall>()
  return {
    add(key: number, part: { id?: string; name?: string; arguments?: string }) {
      const call = calls.get(key) ?? { name: "", arguments: "" }
      if (part.id) call.id = part.id
      if (part.name) call.name = part.name
      call.arguments += part.arguments ?? ""
      calls.set(key, call)
    },
    has: (key: number) => calls.has(key),
    list: () =>
      [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call),
  }
}

type Draft = {
  text: string
  thinking: string
  stopReason?: string
  usage?: Body
  calls: ReturnType<typeof toolCalls>
}

const draft = (): Draft => ({ text: "", thinking: "", calls: toolCalls() })

const finish = (d: Draft): Reassembled => ({
  text: d.text,
  ...(d.thinking && { thinking: d.thinking }),
  toolCalls: d.calls.list(),
  ...(d.stopReason && { stopReason: d.stopReason }),
  ...(d.usage && { usage: d.usage }),
})

function chatCompletions(): Folder {
  const d = draft()
  return {
    fold(payload) {
      const choice = list(payload.choices)[0]
      if (isObject(choice)) {
        const delta = obj(choice.delta)
        d.text += str(delta.content) ?? ""
        for (const call of list(delta.tool_calls)) {
          if (!isObject(call)) continue
          const fn = obj(call.function)
          d.calls.add(typeof call.index === "number" ? call.index : 0, {
            id: str(call.id),
            name: str(fn.name),
            arguments: str(fn.arguments),
          })
        }
        d.stopReason = str(choice.finish_reason) ?? d.stopReason
      }
      if (isObject(payload.usage)) d.usage = payload.usage
    },
    result: () => finish(d),
  }
}

function responses(): Folder {
  const d = draft()
  return {
    fold(payload) {
      const index =
        typeof payload.output_index === "number" ? payload.output_index : 0
      switch (payload.type) {
        case "response.output_text.delta":
          d.text += str(payload.delta) ?? ""
          break
        case "response.output_item.added": {
          const item = obj(payload.item)
          if (item.type === "function_call")
            d.calls.add(index, {
              id: str(item.call_id),
              name: str(item.name),
              arguments: str(item.arguments),
            })
          break
        }
        case "response.function_call_arguments.delta":
          if (d.calls.has(index))
            d.calls.add(index, { arguments: str(payload.delta) })
          break
        case "response.completed":
        case "response.incomplete": {
          const response = obj(payload.response)
          d.stopReason = str(response.status)
          if (isObject(response.usage)) d.usage = response.usage
        }
      }
    },
    result: () => finish(d),
  }
}

function anthropic(): Folder {
  const d = draft()
  return {
    fold(payload) {
      const index = typeof payload.index === "number" ? payload.index : 0
      switch (payload.type) {
        case "message_start": {
          const message = obj(payload.message)
          if (isObject(message.usage)) d.usage = { ...message.usage }
          break
        }
        case "content_block_start": {
          const block = isObject(payload.content_block)
            ? payload.content_block
            : {}
          if (block.type === "tool_use")
            d.calls.add(index, { id: str(block.id), name: str(block.name) })
          break
        }
        case "content_block_delta": {
          const delta = obj(payload.delta)
          if (delta.type === "text_delta") d.text += str(delta.text) ?? ""
          else if (delta.type === "thinking_delta")
            d.thinking += str(delta.thinking) ?? ""
          else if (delta.type === "input_json_delta")
            d.calls.add(index, { arguments: str(delta.partial_json) })
          break
        }
        case "message_delta": {
          const delta = obj(payload.delta)
          d.stopReason = str(delta.stop_reason) ?? d.stopReason
          if (isObject(payload.usage))
            d.usage = { ...d.usage, ...payload.usage }
        }
      }
    },
    result: () => finish(d),
  }
}
