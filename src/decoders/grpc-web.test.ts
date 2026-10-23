import { describe, expect, it } from "vitest"
import { grpcWeb, parseTrailers, readFrames, statusOf } from "./grpc-web"
import { decoders } from "./index"
import { decodeRequest } from "./registry"
import type { RequestView } from "./types"

const frame = (flag: number, data: number[]) => [
  flag,
  ...new Uint8Array(new Uint32Array([data.length]).buffer).reverse(),
  ...data,
]
const ascii = (s: string) => [...new TextEncoder().encode(s)]
const frames = (...data: number[]) => readFrames(new Uint8Array(data))

describe("readFrames", () => {
  it("splits message and trailer frames", () => {
    expect(frames(...frame(0, [8, 1]), ...frame(0x80, ascii("a:b\n")))).toEqual(
      [
        { trailers: false, compressed: false, data: new Uint8Array([8, 1]) },
        {
          trailers: true,
          compressed: false,
          data: new Uint8Array(ascii("a:b\n")),
        },
      ],
    )
  })

  it("flags compressed frames", () => {
    expect(frames(...frame(1, [0xff]))[0].compressed).toBe(true)
  })

  it("reads an empty body as no frames", () => {
    expect(frames()).toEqual([])
  })

  it("throws when a frame runs past the end", () => {
    expect(() => frames(0, 0, 0, 0, 5, 8)).toThrow()
    expect(() => frames(0, 0, 0)).toThrow()
  })
})

describe("trailers", () => {
  const rows = (s: string) => parseTrailers(new TextEncoder().encode(s))

  it("parses trailer lines into lowercased, decoded rows", () => {
    expect(
      rows("grpc-status: 5\r\ngrpc-message: user%209%20missing\r\nX-Id: 1\r\n"),
    ).toEqual([
      { name: "grpc-status", value: "5" },
      { name: "grpc-message", value: "user 9 missing" },
      { name: "x-id", value: "1" },
    ])
  })

  it("names the status", () => {
    expect(
      statusOf([
        { name: "grpc-status", value: "5" },
        { name: "grpc-message", value: "user 9 missing" },
      ]),
    ).toEqual({ name: "NOT_FOUND", text: "NOT_FOUND: user 9 missing" })
    expect(statusOf([{ name: "grpc-status", value: "0" }])).toEqual({
      name: "OK",
      text: "OK",
    })
    expect(statusOf([{ name: "grpc-status", value: "42" }])?.name).toBe(
      "CODE 42",
    )
    expect(statusOf([{ name: "x-id", value: "1" }])).toBeUndefined()
  })
})

describe("grpcWeb requests", () => {
  const body = "\x00\x00\x00\x00\x07\n\x02hi\x10\x96\x01"
  const req = (over: Partial<RequestView> = {}): RequestView => ({
    method: "POST",
    url: "http://x/example.UserService/GetUser",
    status: 200,
    mimeType: "",
    requestBody: { mimeType: "application/grpc-web+proto", text: body },
    ...over,
  })
  const message = { "1": "hi", "2": 150 }

  it("titles by method and decodes the message frame", () => {
    expect(grpcWeb.decode(req())).toEqual({
      title: "GetUser",
      detail: "example.UserService",
      data: { message },
    })
    expect(decodeRequest(req(), decoders)?.kind).toBe("grpc-web")
  })

  it("decodes grpc-web-text bodies", () => {
    const text = btoa(body)
    expect(
      grpcWeb.decode(
        req({ requestBody: { mimeType: "application/grpc-web-text", text } }),
      )?.data,
    ).toEqual({ message })
  })

  it("matches by response mime without a body", () => {
    expect(
      grpcWeb.decode(
        req({ requestBody: undefined, mimeType: "application/grpc-web" }),
      )?.data,
    ).toBeUndefined()
  })

  it("titles other paths by path", () => {
    expect(grpcWeb.decode(req({ url: "http://x/rpc" }))).toMatchObject({
      title: "/rpc",
    })
    expect(grpcWeb.decode(req({ url: "http://x/rpc" }))).not.toHaveProperty(
      "detail",
    )
  })
})
