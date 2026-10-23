import { describe, expect, it } from "vitest"
import { decoders } from "./index"
import { decodeRequest } from "./registry"
import { socketio } from "./socketio"
import type { FrameView } from "./types"

const ws = (url: string) =>
  decodeRequest({ method: "WS", url, status: 101, mimeType: "" }, decoders)

const frame = (text: string, bytes?: number): FrameView => ({
  dir: "in",
  text,
  ...(bytes !== undefined && { bytes }),
})
const decode = (text: string, bytes?: number) =>
  socketio.decodeMessage?.(frame(text, bytes), [])

describe("socketio", () => {
  it("claims Socket.IO sockets", () => {
    expect(ws("ws://x/socket.io/?EIO=4&transport=websocket")).toMatchObject({
      kind: "socketio",
      title: "/socket.io/",
    })
    expect(ws("ws://x/sock")?.kind).toBe("websocket")
  })

  it("titles Engine.IO control frames", () => {
    expect(decode('0{"sid":"a"}')).toEqual({
      title: "open",
      data: { sid: "a" },
    })
    expect(decode("1")).toEqual({ title: "close", data: undefined })
    expect(decode("2")).toEqual({ title: "ping", data: undefined })
    expect(decode("3")).toEqual({ title: "pong", data: undefined })
    expect(decode("2probe")).toEqual({
      title: "ping",
      detail: "probe",
      data: undefined,
    })
    expect(decode("5")).toEqual({ title: "upgrade", data: undefined })
    expect(decode("6")).toEqual({ title: "noop", data: undefined })
  })

  it("leaves binary and unknown frames alone", () => {
    expect(decode("", 4)).toBeUndefined()
    expect(decode("x")).toBeUndefined()
  })
})
