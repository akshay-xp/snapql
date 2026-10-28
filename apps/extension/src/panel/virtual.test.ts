import { describe, expect, it } from "vitest"
import { scrollToRow, visibleRange } from "./virtual"

describe("visibleRange", () => {
  it.each([
    [0, 1000, 10, { start: 0, end: 20 }],
    [2400, 1000, 10, { start: 90, end: 120 }],
    [23760, 1000, 10, { start: 980, end: 1000 }],
    [0, 0, 10, { start: 0, end: 0 }],
    [12, 1000, 0, { start: 0, end: 11 }],
  ])(
    "scrollTop %s, count %s, overscan %s gives %o",
    (scrollTop, count, overscan, range) => {
      expect(visibleRange(scrollTop, 240, 24, count, overscan)).toEqual(range)
    },
  )
})

describe("scrollToRow", () => {
  it.each([
    [5, 0, undefined],
    [20, 0, 264],
    [3, 200, 72],
    [9, 0, undefined],
  ])("row %s at scrollTop %s gives %s", (index, scrollTop, expected) => {
    expect(scrollToRow(index, scrollTop, 240, 24)).toBe(expected)
  })
})
