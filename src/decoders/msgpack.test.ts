import { describe, expect, it } from "vitest"
import { readMsgpack } from "./msgpack"

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
