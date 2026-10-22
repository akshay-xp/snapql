import { describe, expect, it } from "vitest"
import { nextIndex } from "./keys"

describe("nextIndex", () => {
  it.each([
    ["ArrowDown", undefined, 0],
    ["ArrowUp", undefined, 4],
    ["ArrowDown", 4, 4],
    ["ArrowUp", 0, 0],
    ["ArrowDown", 2, 3],
    ["ArrowUp", 2, 1],
    ["Home", 3, 0],
    ["End", 1, 4],
  ])("%s from %s gives %s", (key, current, expected) => {
    expect(nextIndex(key, current, 5)).toBe(expected)
  })

  it("does nothing for an empty list or an unhandled key", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
      expect(nextIndex(key, undefined, 0)).toBeUndefined()
    }
    expect(nextIndex("a", 2, 5)).toBeUndefined()
  })
})
