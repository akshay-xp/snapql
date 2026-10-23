import { describe, expect, it } from "vitest"
import { type Entry, emptyExchange } from "../capture/entry"
import { toHar } from "./har"

const nv = (name: string, value: string) => ({ name, value })

const post: Entry = {
  id: 1,
  method: "POST",
  url: "https://x.test/api?a=1",
  status: 200,
  startedAt: Date.UTC(2026, 9, 23, 9, 5, 7),
  time: 42,
  mimeType: "application/json",
  requestBody: { mimeType: "application/json", text: '{"q":1}' },
  exchange: {
    ...emptyExchange,
    requestHeaders: [nv("content-type", "application/json")],
    responseHeaders: [nv("content-type", "application/json")],
    queryString: [nv("a", "1")],
    requestCookies: [nv("sid", "x")],
    responseCookies: [nv("sid", "y")],
    httpVersion: "HTTP/2",
    statusText: "OK",
    size: 11,
    timings: { ...emptyExchange.timings, wait: 30, receive: 2 },
  },
  getBody: () => Promise.reject(new Error("unused")),
}

const get: Entry = {
  ...post,
  method: "GET",
  requestBody: undefined,
  mimeType: "image/png",
}

describe("toHar", () => {
  const har = toHar(
    [post, get, get],
    [
      { content: '{"ok":true}', encoding: "" },
      { content: "aGk=", encoding: "base64" },
      undefined,
    ],
    "9.9.9",
  )
  const [first, binary, missing] = har.log.entries

  it("writes a HAR 1.2 log", () => {
    expect(har.log.version).toBe("1.2")
    expect(har.log.creator).toEqual({ name: "SnapQL", version: "9.9.9" })
    expect(har.log.entries).toHaveLength(3)
  })

  it("maps request, response, timings and bodies", () => {
    expect(first.startedDateTime).toBe("2026-10-23T09:05:07.000Z")
    expect(first.time).toBe(42)
    expect(first.request).toEqual({
      method: "POST",
      url: "https://x.test/api?a=1",
      httpVersion: "HTTP/2",
      cookies: [nv("sid", "x")],
      headers: [nv("content-type", "application/json")],
      queryString: [nv("a", "1")],
      postData: { mimeType: "application/json", text: '{"q":1}' },
      headersSize: -1,
      bodySize: 7,
    })
    expect(first.response).toEqual({
      status: 200,
      statusText: "OK",
      httpVersion: "HTTP/2",
      cookies: [nv("sid", "y")],
      headers: [nv("content-type", "application/json")],
      content: { size: 11, mimeType: "application/json", text: '{"ok":true}' },
      redirectURL: "",
      headersSize: -1,
      bodySize: 11,
    })
    expect(first.timings).toEqual({
      blocked: -1,
      dns: -1,
      connect: -1,
      ssl: -1,
      send: 0,
      wait: 30,
      receive: 2,
    })
  })

  it("keeps base64 bodies encoded and omits missing ones", () => {
    expect(binary.response.content).toEqual({
      size: 2,
      mimeType: "image/png",
      text: "aGk=",
      encoding: "base64",
    })
    expect(missing.response.content).toEqual({ size: 0, mimeType: "image/png" })
    expect(missing.request.postData).toBeUndefined()
    expect(missing.request.bodySize).toBe(0)
  })

  it("writes socket frames as _webSocketMessages", () => {
    const socket: Entry = {
      ...get,
      method: "WS",
      status: 101,
      socket: { protocol: "" },
      messages: [
        { dir: "out", time: 1000, text: "hi" },
        { dir: "in", time: 2000, text: "", bytes: 2, base64: "AQI=" },
      ],
    }
    const [entry] = toHar([socket], [undefined], "1").log.entries
    expect(entry._resourceType).toBe("websocket")
    expect(entry._webSocketMessages).toEqual([
      { type: "send", time: 1, opcode: 1, data: "hi" },
      { type: "receive", time: 2, opcode: 2, data: "AQI=" },
    ])
  })
})
