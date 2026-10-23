import { describe, expect, it } from "vitest"
import { graphqlWs } from "./graphql-ws"
import { decoders } from "./index"
import { decodeRequest } from "./registry"
import type { FrameView } from "./types"

const ws = (protocols: string[]) =>
  decodeRequest(
    {
      method: "WS",
      url: "ws://x/graphql",
      status: 101,
      mimeType: "",
      protocols,
    },
    decoders,
  )?.kind

const frame = (value: unknown): FrameView => ({
  dir: "in",
  text: typeof value === "string" ? value : JSON.stringify(value),
})
const decode = (value: unknown, frames: FrameView[] = []) =>
  graphqlWs.decodeMessage?.(frame(value), frames)

describe("graphql-ws", () => {
  it("claims sockets requesting a GraphQL subprotocol", () => {
    expect(ws(["graphql-transport-ws"])).toBe("graphql-ws")
    expect(ws(["graphql-ws"])).toBe("graphql-ws")
    expect(ws(["chat"])).toBe("websocket")
  })

  it("titles control frames by type", () => {
    for (const type of [
      "connection_init",
      "connection_ack",
      "connection_error",
      "connection_terminate",
      "ping",
      "pong",
      "ka",
    ])
      expect(decode({ type })).toEqual({ title: type, data: undefined })
    expect(decode({ type: "connection_init", payload: { token: 1 } })).toEqual({
      title: "connection_init",
      data: { token: 1 },
    })
  })

  it("leaves other frames alone", () => {
    expect(decode("not json")).toBeUndefined()
    expect(decode({ type: 1 })).toBeUndefined()
  })
})
