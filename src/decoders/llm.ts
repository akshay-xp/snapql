import { parseJson } from "./json"
import type { StreamEvent } from "./stream"
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
    return { title: body.model, detail: "stream", data: body }
  },
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
    list: () =>
      [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call),
  }
}

function chatCompletions(): Folder {
  let text = ""
  let stopReason: string | undefined
  let usage: Body | undefined
  const calls = toolCalls()
  return {
    fold(payload) {
      const choice = list(payload.choices)[0]
      if (isObject(choice)) {
        const delta = isObject(choice.delta) ? choice.delta : {}
        text += str(delta.content) ?? ""
        for (const call of list(delta.tool_calls)) {
          if (!isObject(call)) continue
          const fn = isObject(call.function) ? call.function : {}
          calls.add(typeof call.index === "number" ? call.index : 0, {
            id: str(call.id),
            name: str(fn.name),
            arguments: str(fn.arguments),
          })
        }
        stopReason = str(choice.finish_reason) ?? stopReason
      }
      if (isObject(payload.usage)) usage = payload.usage
    },
    result: () => ({
      text,
      toolCalls: calls.list(),
      ...(stopReason && { stopReason }),
      ...(usage && { usage }),
    }),
  }
}
