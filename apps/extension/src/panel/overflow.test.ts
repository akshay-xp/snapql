import { describe, expect, it } from "vitest"
import { overflowEdges } from "./overflow"

const at = (scrollLeft: number, scrollWidth = 300) =>
  overflowEdges({ scrollLeft, clientWidth: 100, scrollWidth })

describe("overflowEdges", () => {
  it("flags the sides that hide content", () => {
    expect(at(0, 100)).toEqual({ left: false, right: false })
    expect(at(0)).toEqual({ left: false, right: true })
    expect(at(100)).toEqual({ left: true, right: true })
    expect(at(200)).toEqual({ left: true, right: false })
  })

  it("treats a subpixel remainder at the end as the end", () => {
    expect(at(199.5)).toEqual({ left: true, right: false })
  })
})
