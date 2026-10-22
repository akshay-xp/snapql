import { describe, expect, it } from "vitest"
import { pairsText, valueText } from "./copy"

describe("valueText", () => {
  it("keeps strings and pretty-prints everything else", () => {
    expect(valueText("query A { a }")).toBe("query A { a }")
    expect(valueText({ id: 1 })).toBe('{\n  "id": 1\n}')
    expect(valueText([1])).toBe("[\n  1\n]")
    expect(valueText(3)).toBe("3")
  })
})

describe("pairsText", () => {
  it("writes one name = value line per pair", () => {
    expect(
      pairsText([
        { name: "a", value: "1" },
        { name: "b", value: "x y" },
      ]),
    ).toBe("a = 1\nb = x y")
    expect(pairsText([])).toBe("")
  })
})
