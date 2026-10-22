import { describe, expect, it } from "vitest"
import { brackets, children, clip, sizeLabel, startsOpen } from "./json"

describe("children", () => {
  it("lists object keys and array indexes", () => {
    expect(children({ a: 1, b: [2] })).toEqual([
      ["a", 1],
      ["b", [2]],
    ])
    expect(children([7, 8])).toEqual([
      ["0", 7],
      ["1", 8],
    ])
  })

  it("gives leaves no children", () => {
    expect(children("x")).toBeUndefined()
    expect(children(null)).toBeUndefined()
    expect(children(3)).toBeUndefined()
  })
})

describe("labels", () => {
  it("sizes collapsed nodes", () => {
    expect(sizeLabel({ a: 1 })).toBe("{…} 1 key")
    expect(sizeLabel({ a: 1, b: 2 })).toBe("{…} 2 keys")
    expect(sizeLabel([1])).toBe("[…] 1 item")
    expect(sizeLabel([])).toBe("[]")
    expect(sizeLabel({})).toBe("{}")
  })

  it("counts open nodes in brackets", () => {
    expect(brackets({ a: 1 })).toBe("{1}")
    expect(brackets([1, 2])).toBe("[2]")
  })
})

describe("startsOpen", () => {
  it("opens the first three levels", () => {
    expect(startsOpen(0)).toBe(true)
    expect(startsOpen(2)).toBe(true)
    expect(startsOpen(3)).toBe(false)
  })
})

describe("clip", () => {
  it("clips strings over 200 characters", () => {
    const a200 = "a".repeat(200)
    expect(clip(a200)).toEqual({ head: a200, clipped: false })
    expect(clip(`${a200}a`)).toEqual({ head: a200, clipped: true })
  })
})
