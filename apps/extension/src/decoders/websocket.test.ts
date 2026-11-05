import { describe, expect, it } from "vitest"
import { decoders } from "./index"
import { decodeRequest } from "./registry"
import type { RequestView } from "./types"
import { isProtocolName, websocket } from "./websocket"

const socket = (over: Partial<RequestView> = {}): RequestView => ({
  method: "WS",
  url: "ws://x/sock?a=1",
  status: 101,
  mimeType: "",
  ...over,
})

describe("websocket", () => {
  it("titles sockets by path, detailed by requested protocols", () => {
    expect(websocket.decode(socket({ protocols: ["chat", "v2"] }))).toEqual({
      title: "/sock",
      detail: "chat, v2",
      data: undefined,
    })
    expect(websocket.decode(socket({ protocols: [] }))).not.toHaveProperty(
      "detail",
    )
    expect(websocket.decode(socket({ method: "GET" }))).toBeUndefined()
    expect(decodeRequest(socket(), decoders)?.kind).toBe("websocket")
  })

  it("details only protocol names, never token subprotocols", () => {
    const token = "%7B%22token%22%3A%22abc%22%7D"
    for (const name of [
      "chat",
      "graphql-transport-ws",
      "v12.stomp",
      "my_proto",
    ])
      expect(isProtocolName(name), name).toBe(true)
    for (const value of [token, "a b", "abc=", "", "a".repeat(41)])
      expect(isProtocolName(value), value).toBe(false)
    expect(
      websocket.decode(socket({ protocols: ["chat", token] }))?.detail,
    ).toBe("chat")
    expect(websocket.decode(socket({ protocols: [token] }))).not.toHaveProperty(
      "detail",
    )
  })
})
