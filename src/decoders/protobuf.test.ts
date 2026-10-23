import { describe, expect, it } from "vitest"
import { parseFirst } from "./bytes"
import { decoders } from "./index"
import { protobuf, readMessage } from "./protobuf"
import { decodeRequest } from "./registry"
import type { RequestView } from "./types"

const read = (...data: number[]) => readMessage(new Uint8Array(data))

function varint(n: bigint): number[] {
  const out: number[] = []
  do {
    const byte = Number(n & 0x7fn)
    n >>= 7n
    out.push(n ? byte | 0x80 : byte)
  } while (n)
  return out
}

const le = (size: number, write: (v: DataView) => void) => {
  const view = new DataView(new ArrayBuffer(size))
  write(view)
  return [...new Uint8Array(view.buffer)]
}

describe("readMessage", () => {
  it("reads varints keyed by field number", () => {
    expect(read(0x08, 0x96, 0x01)).toEqual({ "1": 150 })
  })

  it("collects repeated fields into arrays", () => {
    expect(read(0x08, 1, 0x08, 2)).toEqual({ "1": [1, 2] })
  })

  it("reads 64-bit varints with the top bit set as signed", () => {
    expect(read(0x08, ...varint(2n ** 64n - 1n))).toEqual({ "1": -1 })
  })

  it("gives unsafe integers as decimal strings", () => {
    expect(read(0x08, ...varint(2n ** 60n))).toEqual({
      "1": "1152921504606846976",
    })
  })

  it("reads fixed32 as an unsigned int and a float", () => {
    expect(read(0x0d, ...le(4, (v) => v.setFloat32(0, 1.5, true)))).toEqual({
      "1": { fixed32: 1069547520, float: 1.5 },
    })
  })

  it("reads fixed64 as an unsigned int and a double", () => {
    expect(read(0x09, ...le(8, (v) => v.setFloat64(0, 3.14, true)))).toEqual({
      "1": { fixed64: "4614253070214989087", double: 3.14 },
    })
  })

  it("reads an empty message", () => {
    expect(read()).toEqual({})
  })

  it("reads printable length-delimited fields as strings", () => {
    expect(read(0x0a, 2, 0x68, 0x69)).toEqual({ "1": "hi" })
    expect(read(0x0a, 2, 0xc3, 0xa9)).toEqual({ "1": "é" })
    expect(read(0x0a, 0)).toEqual({ "1": "" })
  })

  it("reads other length-delimited fields as messages, else hex", () => {
    expect(read(0x0a, 3, 0x08, 0x96, 0x01)).toEqual({ "1": { "1": 150 } })
    expect(read(0x0a, 5, 0x0a, 3, 0x08, 0x96, 0x01)).toEqual({
      "1": { "1": { "1": 150 } },
    })
    expect(read(0x0a, 2, 0xff, 0xfe)).toEqual({ "1": "ff fe" })
  })
})

describe("readMessage candidates", () => {
  const data = (...candidates: number[][]) =>
    parseFirst(
      candidates.map((c) => new Uint8Array(c)),
      readMessage,
    )
  const error = (at: number, hex: string) => ({
    error: `invalid protobuf at byte ${at}`,
    hex,
  })

  it("gives the message of valid input", () => {
    expect(data([0x08, 1])).toEqual({ value: { "1": 1 } })
  })

  it("reports where malformed input broke", () => {
    expect(data([0x08, 0x96])).toEqual(error(1, "08 96"))
    expect(data([0x0b])).toEqual(error(0, "0b"))
    expect(data([0x00, 0x01])).toEqual(error(0, "00 01"))
    expect(data([0x0a, 5, 0x68])).toEqual(error(1, "0a 05 68"))
  })

  it("keeps the first candidate that parses", () => {
    expect(data([0xe9, 1], [0x0a, 1, 0x41])).toEqual({ value: { "1": "A" } })
  })

  it("reports the first candidate when none parses", () => {
    expect(data([0x0b], [0x08])).toEqual(error(0, "0b"))
  })
})

describe("protobuf", () => {
  const req = (over: Partial<RequestView> = {}): RequestView => ({
    method: "POST",
    url: "http://x/api/proto",
    status: 200,
    mimeType: "",
    requestBody: { mimeType: "application/x-protobuf", text: "\n\x02hi" },
    ...over,
  })

  it("decodes protobuf request bodies", () => {
    expect(protobuf.decode(req())).toEqual({
      title: "/api/proto",
      detail: "POST",
      data: { message: { "1": "hi" } },
    })
    expect(decodeRequest(req(), decoders)?.kind).toBe("protobuf")
  })

  it("matches protobuf responses", () => {
    const get = (mimeType: string) =>
      protobuf.decode(req({ method: "GET", requestBody: undefined, mimeType }))
    expect(get("application/protobuf")).toEqual({
      title: "/api/proto",
      detail: "GET",
      data: undefined,
    })
    expect(get("application/vnd.google.protobuf; proto=x")).toBeDefined()
  })

  it("ignores other bodies", () => {
    expect(
      protobuf.decode(
        req({ requestBody: { mimeType: "application/json", text: "{}" } }),
      ),
    ).toBeUndefined()
  })

  it("decodes response bodies", () => {
    expect(
      protobuf.decodeResponse?.(
        { content: btoa("\x08\x01"), encoding: "base64" },
        { kind: "protobuf", title: "/api/proto", data: undefined },
        [],
      ),
    ).toEqual({ summary: "2 bytes", data: { message: { "1": 1 } } })
  })
})
