import { describe, expect, it } from "vitest"
import { parseTrailers, readFrames, statusOf } from "./grpc-web"

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
