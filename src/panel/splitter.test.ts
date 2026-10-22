import { describe, expect, it } from "vitest"
import { clampWidth } from "./splitter"

describe("clampWidth", () => {
  it.each([
    [300, 1000, 300],
    [100, 1000, 200],
    [900, 1000, 800],
    [300, 300, 150],
  ])("width %s in container %s gives %s", (width, container, expected) => {
    expect(clampWidth(width, container, 200)).toBe(expected)
  })
})
