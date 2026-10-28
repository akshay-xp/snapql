import { describe, expect, it } from "vitest"
import { decoders } from "./index"
import { msgpack, readMsgpack } from "./msgpack"
import { decodeRequest } from "./registry"
import type { RequestView } from "./types"

const read = (...data: number[]) => readMsgpack(new Uint8Array(data))
const be = (size: number, write: (v: DataView) => void) => {
  const view = new DataView(new ArrayBuffer(size))
  write(view)
  return [...new Uint8Array(view.buffer)]
}

describe("readMsgpack scalars", () => {
  it("reads nil and booleans", () => {
    expect(read(0xc0)).toBeNull()
    expect(read(0xc2)).toBe(false)
    expect(read(0xc3)).toBe(true)
  })

  it("reads fixints and sized ints", () => {
    expect(read(0x7f)).toBe(127)
    expect(read(0xff)).toBe(-1)
    expect(read(0xcc, 0xff)).toBe(255)
    expect(read(0xcd, 0x01, 0x00)).toBe(256)
    expect(read(0xce, ...be(4, (v) => v.setUint32(0, 2 ** 32 - 1)))).toBe(
      2 ** 32 - 1,
    )
    expect(read(0xd0, 0x80)).toBe(-128)
    expect(read(0xd1, ...be(2, (v) => v.setInt16(0, -300)))).toBe(-300)
    expect(read(0xd2, ...be(4, (v) => v.setInt32(0, -70000)))).toBe(-70000)
  })

  it("reads 64-bit ints, unsafe ones as strings", () => {
    expect(read(0xcf, ...be(8, (v) => v.setBigUint64(0, 2n ** 60n)))).toBe(
      "1152921504606846976",
    )
    expect(read(0xd3, ...be(8, (v) => v.setBigInt64(0, -1n)))).toBe(-1)
  })

  it("reads floats", () => {
    expect(read(0xca, 0x3f, 0xc0, 0x00, 0x00)).toBe(1.5)
    expect(read(0xcb, ...be(8, (v) => v.setFloat64(0, 3.14)))).toBe(3.14)
  })

  it("reads strings and bin as hex", () => {
    expect(read(0xa2, 0x68, 0x69)).toBe("hi")
    expect(read(0xd9, 2, 0x68, 0x69)).toBe("hi")
    expect(read(0xda, 0, 2, 0x68, 0x69)).toBe("hi")
    expect(read(0xdb, 0, 0, 0, 2, 0x68, 0x69)).toBe("hi")
    expect(read(0xc4, 2, 0x0a, 0xff)).toBe("0a ff")
  })
})

describe("readMsgpack containers", () => {
  it("reads arrays", () => {
    expect(read(0x92, 0x01, 0xa1, 0x61)).toEqual([1, "a"])
    expect(read(0xdc, 0, 1, 0x01)).toEqual([1])
  })

  it("reads maps, stringifying non-string keys", () => {
    expect(read(0x81, 0xa1, 0x61, 0x01)).toEqual({ a: 1 })
    expect(read(0x81, 0x01, 0x02)).toEqual({ "1": 2 })
    expect(read(0x81, 0xc3, 0x01)).toEqual({ true: 1 })
    expect(read(0x81, 0x91, 0x01, 0x02)).toEqual({ "[1]": 2 })
  })

  it("reads ext types", () => {
    expect(read(0xd4, 0x05, 0xaa)).toEqual({ type: 5, data: "aa" })
  })

  it("reads timestamps as ISO strings", () => {
    expect(read(0xd6, 0xff, 0, 0, 0, 0)).toBe("1970-01-01T00:00:00.000Z")
    const ts64 = be(8, (v) => v.setBigUint64(0, (500000000n << 34n) | 1n))
    expect(read(0xd7, 0xff, ...ts64)).toBe("1970-01-01T00:00:01.500Z")
    const ts96 = be(12, (v) => {
      v.setUint32(0, 0)
      v.setBigInt64(4, -1n)
    })
    expect(read(0xc7, 12, 0xff, ...ts96)).toBe("1969-12-31T23:59:59.000Z")
  })
})

describe("readMsgpack errors", () => {
  const error = (at: number, ...data: number[]) =>
    expect(() => read(...data)).toThrow(`invalid msgpack at byte ${at}`)

  it("reports where input broke", () => {
    error(0, 0xc1)
    error(2, 0x92, 0x01)
    error(1, 0x01, 0x02)
    error(0, 0xa5, 0x68)
  })
})

describe("msgpack decoder", () => {
  const req = (over: Partial<RequestView> = {}): RequestView => ({
    method: "POST",
    url: "http://x/api/m",
    status: 200,
    mimeType: "",
    requestBody: { mimeType: "application/msgpack", text: "\x81\xa1a\x01" },
    ...over,
  })
  const respond = (...data: number[]) =>
    msgpack.decodeResponse?.(
      { content: btoa(String.fromCharCode(...data)), encoding: "base64" },
      { kind: "msgpack", title: "/api/m", data: undefined },
      [],
    )

  it("decodes request bodies", () => {
    expect(msgpack.decode(req())).toEqual({
      title: "/api/m",
      detail: "POST",
      data: { body: { a: 1 } },
    })
    expect(decodeRequest(req(), decoders)?.kind).toBe("msgpack")
  })

  it("matches responses without a body", () => {
    for (const mimeType of ["application/x-msgpack", "application/vnd.msgpack"])
      expect(
        msgpack.decode(req({ requestBody: undefined, mimeType }))?.data,
      ).toBeUndefined()
  })

  it("decodes responses, malformed ones as hex", () => {
    expect(respond(0x81, 0xa1, 0x61, 0x01)).toEqual({
      summary: "4 bytes",
      data: { body: { a: 1 } },
    })
    expect(respond(0xc1)?.data).toEqual({
      error: "invalid msgpack at byte 0",
      hex: "c1",
    })
  })
})
