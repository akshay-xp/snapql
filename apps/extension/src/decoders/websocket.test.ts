import { describe, expect, it } from "vitest"
import { decoders } from "./index"
import { decodeRequest } from "./registry"
import type { RequestView } from "./types"
import { websocket } from "./websocket"

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
})
