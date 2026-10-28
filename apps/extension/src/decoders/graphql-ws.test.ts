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

  describe("operations", () => {
    const payload = { query: "subscription OnMsg { msg }" }
    const subscribe = { type: "subscribe", id: "1", payload }

    it("titles subscribe and start frames by operation name", () => {
      expect(decode(subscribe)).toEqual({
        title: "OnMsg",
        detail: "subscribe",
        data: payload,
      })
      expect(decode({ ...subscribe, type: "start" })?.detail).toBe("start")
      expect(
        decode({ ...subscribe, payload: { query: "subscription { msg }" } })
          ?.title,
      ).toBe("anonymous")
      expect(
        decode({
          ...subscribe,
          payload: {
            query: "subscription A { a } subscription B { b }",
            operationName: "B",
          },
        })?.title,
      ).toBe("B")
      expect(
        decode({
          ...subscribe,
          payload: {
            extensions: { persistedQuery: { sha256Hash: "abcdef1234567890" } },
          },
        })?.title,
      ).toBe("abcdef12")
    })

    it("names result and stop frames by the operation of their id", () => {
      const frames = [frame(subscribe)]
      for (const type of ["next", "data", "error", "complete", "stop"])
        expect(decode({ type, id: "1", payload: { x: 1 } }, frames)).toEqual({
          title: "OnMsg",
          detail: type,
          data: { x: 1 },
        })
      expect(decode({ type: "next", id: "9" }, frames)?.title).toBe("9")
    })
  })
})
