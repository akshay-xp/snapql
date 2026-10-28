import { describe, expect, it } from "vitest"
import { clampSize, isStacked } from "./splitter"

describe("clampSize", () => {
  it.each([
    [300, 1000, 300],
    [100, 1000, 200],
    [900, 1000, 800],
    [300, 300, 150],
  ])("size %s in container %s gives %s", (size, container, expected) => {
    expect(clampSize(size, container, 200)).toBe(expected)
  })
})

describe("isStacked", () => {
  it("stacks the panes when the panel is taller than wide", () => {
    expect(isStacked(554, 606)).toBe(true)
    expect(isStacked(1100, 650)).toBe(false)
    expect(isStacked(600, 600)).toBe(false)
  })
})
