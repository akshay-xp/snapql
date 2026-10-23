import { describe, expect, it } from "vitest"
import { readCbor } from "./cbor"

const read = (...data: number[]) => readCbor(new Uint8Array(data))
const be = (size: number, write: (v: DataView) => void) => {
  const view = new DataView(new ArrayBuffer(size))
  write(view)
  return [...new Uint8Array(view.buffer)]
}
const ascii = (s: string) => [...new TextEncoder().encode(s)]

describe("readCbor", () => {
  it("reads integers", () => {
    expect(read(0x00)).toBe(0)
    expect(read(0x17)).toBe(23)
    expect(read(0x18, 0x18)).toBe(24)
    expect(read(0x19, 0x01, 0x00)).toBe(256)
    expect(read(0x1a, ...be(4, (v) => v.setUint32(0, 70000)))).toBe(70000)
    expect(read(0x1b, ...be(8, (v) => v.setBigUint64(0, 2n ** 60n)))).toBe(
      "1152921504606846976",
    )
    expect(read(0x20)).toBe(-1)
    expect(read(0x38, 0x63)).toBe(-100)
  })

  it("reads byte and text strings, definite and indefinite", () => {
    expect(read(0x42, 0x0a, 0xff)).toBe("0a ff")
    expect(read(0x62, 0x68, 0x69)).toBe("hi")
    expect(read(0x5f, 0x41, 0x0a, 0x41, 0xff, 0xff)).toBe("0a ff")
    expect(read(0x7f, 0x61, 0x68, 0x61, 0x69, 0xff)).toBe("hi")
  })

  it("reads arrays and maps, definite and indefinite", () => {
    expect(read(0x82, 0x01, 0x02)).toEqual([1, 2])
    expect(read(0x9f, 0x01, 0xff)).toEqual([1])
    expect(read(0xa1, 0x61, 0x61, 0x01)).toEqual({ a: 1 })
    expect(read(0xa1, 0x01, 0x02)).toEqual({ "1": 2 })
    expect(read(0xbf, 0x61, 0x61, 0x01, 0xff)).toEqual({ a: 1 })
  })

  it("reads tags", () => {
    expect(read(0xc1, 0x00)).toBe("1970-01-01T00:00:00.000Z")
    const date = "2013-03-21T20:04:00Z"
    expect(read(0xc0, 0x74, ...ascii(date))).toBe(date)
    expect(read(0xd8, 0x20, 0x63, ...ascii("abc"))).toEqual({
      tag: 32,
      value: "abc",
    })
  })

  it("reads simple values and floats", () => {
    expect(read(0xf4)).toBe(false)
    expect(read(0xf5)).toBe(true)
    expect(read(0xf6)).toBeNull()
    expect(read(0xf7)).toBeUndefined()
    expect(read(0xf0)).toEqual({ simple: 16 })
    expect(read(0xf9, 0x3c, 0x00)).toBe(1)
    expect(read(0xf9, 0x7c, 0x00)).toBe(Number.POSITIVE_INFINITY)
    expect(read(0xf9, 0x00, 0x01)).toBe(2 ** -24)
    expect(read(0xfa, 0x3f, 0xc0, 0x00, 0x00)).toBe(1.5)
    expect(read(0xfb, ...be(8, (v) => v.setFloat64(0, 3.14)))).toBe(3.14)
  })

  it("reports where input broke", () => {
    const error = (at: number, ...data: number[]) =>
      expect(() => read(...data)).toThrow(`invalid cbor at byte ${at}`)
    error(0, 0xff)
    error(0, 0x1c)
    error(2, 0x82, 0x01)
    error(1, 0x01, 0x02)
  })
})
