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

  it("titles connect, disconnect and connect errors", () => {
    expect(decode("40")).toEqual({ title: "connect" })
    expect(decode('40{"sid":"b"}')).toEqual({
      title: "connect",
      data: { sid: "b" },
    })
    expect(decode("41")).toEqual({ title: "disconnect" })
    expect(decode('44{"message":"no"}')).toEqual({
      title: "connect_error",
      data: { message: "no" },
    })
  })

  it("titles events by name, with namespace and ack id", () => {
    expect(decode('42["chat",{"text":"hi"}]')).toEqual({
      title: "chat",
      data: { args: [{ text: "hi" }] },
    })
    expect(decode('42/admin,["chat"]')).toEqual({
      title: "chat",
      detail: "/admin",
      data: { args: [] },
    })
    expect(decode('4212["chat"]')).toEqual({
      title: "chat",
      data: { args: [], ack: 12 },
    })
    expect(decode('431["ok"]')).toEqual({
      title: "ack 1",
      data: { args: ["ok"] },
    })
  })

  it("marks binary events and acks", () => {
    expect(decode('451-["up",{"_placeholder":true,"num":0}]')).toEqual({
      title: "up",
      detail: "binary",
      data: { args: [{ _placeholder: true, num: 0 }] },
    })
    expect(decode("461-0[]")).toEqual({
      title: "ack 0",
      detail: "binary",
      data: { args: [] },
    })
    expect(decode('451-/admin,["up"]')?.detail).toBe("/admin, binary")
  })
})
