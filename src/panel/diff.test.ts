import { describe, expect, it } from "vitest"
import { diffLines } from "./diff"

const ops = (a: string, b: string) => diffLines(a, b).map((l) => l.op + l.text)

describe("diffLines", () => {
  it("keeps identical lines equal", () => {
    expect(ops("a\nb", "a\nb")).toEqual([" a", " b"])
  })

  it("marks inserts, deletes and replacements", () => {
    expect(ops("a\nc", "a\nb\nc")).toEqual([" a", "+b", " c"])
    expect(ops("a\nb\nc", "a\nc")).toEqual([" a", "-b", " c"])
    expect(ops("a\nb\nc", "a\nx\nc")).toEqual([" a", "-b", "+x", " c"])
  })

  it("handles empty sides", () => {
    expect(ops("", "a")).toEqual(["+a"])
    expect(ops("a", "")).toEqual(["-a"])
    expect(ops("", "")).toEqual([])
  })

  it("finds a minimal edit script", () => {
    const lines = diffLines("a\nb\nc\na\nb\nb\na", "c\nb\na\nb\na\nc")
    expect(lines.filter((l) => l.op !== " ")).toHaveLength(5)
    expect(
      lines
        .filter((l) => l.op !== "+")
        .map((l) => l.text)
        .join(""),
    ).toBe("abcabba")
    expect(
      lines
        .filter((l) => l.op !== "-")
        .map((l) => l.text)
        .join(""),
    ).toBe("cbabac")
  })
})
