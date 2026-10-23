import { describe, expect, it } from "vitest"
import {
  grpcRequestData,
  grpcResponse,
  grpcWeb,
  parseTrailers,
  readFrames,
  statusOf,
} from "./grpc-web"
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

describe("grpcWeb responses", () => {
  const decoded = { kind: "grpc-web", title: "GetUser", data: undefined }
  const toBase64 = (data: number[]) => btoa(String.fromCharCode(...data))
  const respond = (
    data: number[],
    headers: { name: string; value: string }[] = [],
  ) =>
    grpcWeb.decodeResponse?.(
      { content: toBase64(data), encoding: "base64" },
      decoded,
      headers,
    )
  const ok = frame(0x80, ascii("grpc-status:0\r\n"))

  it("gives the message, status and trailers", () => {
    expect(respond([...frame(0, [8, 1]), ...ok])).toEqual({
      summary: "OK",
      data: {
        message: { "1": 1 },
        status: "OK",
        trailers: [{ name: "grpc-status", value: "0" }],
      },
    })
  })

  it("numbers server-streamed messages", () => {
    const data = respond([...frame(0, [8, 1]), ...frame(0, [8, 2]), ...ok])
      ?.data as Record<string, unknown>
    expect(data["message 1"]).toEqual({ "1": 1 })
    expect(data["message 2"]).toEqual({ "1": 2 })
  })

  it("decodes grpc-web-text responses made of padded chunks", () => {
    const content = toBase64(frame(0, [8, 1])) + toBase64(ok)
    expect(content.slice(0, -4)).toContain("=")
    expect(
      grpcWeb.decodeResponse?.({ content, encoding: "" }, decoded, [
        { name: "content-type", value: "application/grpc-web-text" },
      ]),
    ).toMatchObject({ summary: "OK", data: { message: { "1": 1 } } })
  })

  it("reads trailers-only status from the headers", () => {
    expect(
      respond(
        [],
        [
          { name: "Grpc-Status", value: "5" },
          { name: "grpc-message", value: "gone" },
        ],
      ),
    ).toEqual({ summary: "NOT_FOUND", data: { status: "NOT_FOUND: gone" } })
  })

  it("says when there is no status", () => {
    expect(respond(frame(0, [8, 1]))).toEqual({
      summary: "no status",
      data: { message: { "1": 1 } },
    })
  })

  it("shows compressed frames as hex", () => {
    expect(respond([...frame(1, [0xff]), ...ok])?.data).toMatchObject({
      message: { compressed: "ff" },
    })
  })
})

describe("gRPC-web message readers", () => {
  const read = () => "R"

  it("reads request messages with the given reader", () => {
    const body = String.fromCharCode(...frame(0, [8, 1]))
    expect(grpcRequestData("application/grpc-web+proto", body, read)).toEqual({
      message: "R",
    })
  })

  it("reads response messages with the given reader", () => {
    const data = [...frame(0, [8, 1]), ...frame(0x80, ascii("grpc-status:0"))]
    const body = {
      content: btoa(String.fromCharCode(...data)),
      encoding: "base64",
    }
    expect(grpcResponse(body, [], read)).toMatchObject({
      summary: "OK",
      data: { message: "R" },
    })
  })
})
