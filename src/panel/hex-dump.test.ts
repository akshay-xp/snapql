import { describe, expect, it } from "vitest"
import { hexDump } from "./hex-dump"

const bytes = (...data: number[]) => new Uint8Array(data)

describe("hexDump", () => {
  it("shows offset, hex bytes and printable ASCII", () => {
    expect(hexDump(bytes(0x68, 0x69, 0x00))).toBe(
      `00000000  68 69 00${" ".repeat(13 * 3)}  |hi.|`,
    )
  })

  it("puts 16 bytes on a line", () => {
    const lines = hexDump(new Uint8Array(17)).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[1].startsWith("00000010  00")).toBe(true)
  })

  it("stops at the limit and counts the rest", () => {
    const lines = hexDump(new Uint8Array(20), 16).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe("… 4 more bytes")
  })

  it("gives nothing for no bytes", () => {
    expect(hexDump(bytes())).toBe("")
  })
})
