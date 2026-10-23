import { describe, expect, it } from "vitest"
import {
  arrow,
  byteLabel,
  frameLabel,
  messageBytes,
  messageText,
  offsetLabel,
  preview,
} from "./messages"

describe("message labels", () => {
  it("formats byte sizes in base 1000", () => {
    expect(byteLabel(0)).toBe("0 B")
    expect(byteLabel(999)).toBe("999 B")
    expect(byteLabel(1234)).toBe("1.2 kB")
    expect(byteLabel(1_500_000)).toBe("1.5 MB")
  })

  it("sizes text as UTF-8, binary frames by their byte count", () => {
    expect(messageBytes({ text: "é" })).toBe(2)
    expect(messageBytes({ text: "", bytes: 9 })).toBe(9)
  })

  it("formats offsets in seconds", () => {
    expect(offsetLabel(1234)).toBe("+1.234s")
    expect(offsetLabel(0)).toBe("+0.000s")
  })

  it("previews on one line", () => {
    expect(preview('  {\n  "a": 1 }')).toBe('{ "a": 1 }')
  })

  it("labels binary frames by size and shows direction arrows", () => {
    expect(messageText({ text: "", bytes: 4 })).toBe("binary 4 B")
    expect(messageText({ text: "  a\n b" })).toBe("a b")
    expect(arrow("out")).toBe("↑")
    expect(arrow("in")).toBe("↓")
  })

  it("labels frames with their decoded title", () => {
    expect(
      frameLabel(
        { text: '42["chat"]' },
        { title: "chat", detail: "/admin", data: {} },
      ),
    ).toEqual({ text: "chat", detail: "/admin" })
    expect(frameLabel({ text: " a\n b" })).toEqual({ text: "a b" })
    expect(
      frameLabel({ text: "", bytes: 4 }, { title: "up", data: undefined }),
    ).toEqual({ text: "up" })
  })
})
