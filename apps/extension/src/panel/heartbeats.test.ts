import { describe, expect, it } from "vitest"
import { createShowHeartbeats } from "./heartbeats"

const memory = () => {
  const items = new Map<string, string>()
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    items,
  }
}

describe("createShowHeartbeats", () => {
  it("starts hidden and remembers showing", () => {
    const storage = memory()
    const [show, setShow] = createShowHeartbeats(storage)
    expect(show()).toBe(false)
    setShow(true)
    expect(show()).toBe(true)
    expect(storage.items.get("snapql.showHeartbeats")).toBe("true")
    expect(createShowHeartbeats(storage)[0]()).toBe(true)
  })

  it("reads anything else as hidden", () => {
    const storage = memory()
    storage.items.set("snapql.showHeartbeats", "yes")
    expect(createShowHeartbeats(storage)[0]()).toBe(false)
  })

  it("works without storage, or when saving throws", () => {
    const [show, setShow] = createShowHeartbeats(undefined)
    setShow(true)
    expect(show()).toBe(true)
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota")
      },
    }
    const [shown, setShown] = createShowHeartbeats(full)
    setShown(true)
    expect(shown()).toBe(true)
  })
})
