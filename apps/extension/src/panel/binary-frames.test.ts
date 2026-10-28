import { describe, expect, it } from "vitest"
import { binaryFormat, decodeBinaryFrame } from "./binary-frames"
import { hexDump } from "./hex-dump"

const frame = (...data: number[]) => ({
  text: "",
  bytes: data.length,
  base64: btoa(String.fromCharCode(...data)),
})

describe("binaryFormat", () => {
  it("picks a reader from the socket's protocols", () => {
    expect(binaryFormat(["chat", "x.msgpack"])).toBe("msgpack")
    expect(binaryFormat(["cbor"])).toBe("cbor")
    expect(binaryFormat(["v1.proto"])).toBe("protobuf")
    expect(binaryFormat(["chat"])).toBe("hex")
    expect(binaryFormat([])).toBe("hex")
  })
})

describe("decodeBinaryFrame", () => {
  it("titles decoded frames by their value", () => {
    expect(decodeBinaryFrame(frame(0x81, 0xa1, 0x61, 0x01), "msgpack")).toEqual(
      { title: '{"a":1}', detail: "msgpack", data: { a: 1 } },
    )
    expect(decodeBinaryFrame(frame(0xf5), "cbor").title).toBe("true")
    expect(decodeBinaryFrame(frame(0x08, 0x01), "protobuf").title).toBe(
      '{"1":1}',
    )
  })

  it("shows hex frames as a dump", () => {
    expect(decodeBinaryFrame(frame(1, 2, 3, 4), "hex")).toEqual({
      title: "binary 4 B",
      data: hexDump(new Uint8Array([1, 2, 3, 4])),
    })
  })

  it("falls back to the dump when the format doesn't parse", () => {
    expect(decodeBinaryFrame(frame(0xc1), "msgpack")).toEqual({
      title: "binary 1 B",
      detail: "invalid msgpack",
      data: `invalid msgpack at byte 0\n\n${hexDump(new Uint8Array([0xc1]))}`,
    })
  })
})
