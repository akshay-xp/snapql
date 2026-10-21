import { describe, expect, it, vi } from "vitest"
import { toEntry } from "./entry"
import { createStore } from "./store"

function entry(id: number) {
  return toEntry(
    {
      method: "GET",
      url: `https://api.test/${id}`,
      status: 200,
      startedDateTime: "2026-10-22T10:00:00.000Z",
      time: 1,
      fetchBody: () => Promise.resolve({ content: "", encoding: "" }),
    },
    id,
  )
}

describe("createStore", () => {
  it("snapshots entries in insertion order without mutating old snapshots", () => {
    const store = createStore()
    const a = entry(1)
    const b = entry(2)

    store.add(a)
    const before = store.snapshot()
    store.add(b)

    expect(store.snapshot()).toEqual([a, b])
    expect(before).toEqual([a])
  })

  it("evicts the oldest entries beyond the cap", () => {
    const store = createStore(2)

    for (const id of [1, 2, 3]) {
      store.add(entry(id))
      expect(store.snapshot().length).toBeLessThanOrEqual(2)
    }

    expect(store.snapshot()).toHaveLength(2)
    expect(store.snapshot().map((e) => e.id)).toEqual([2, 3])
  })

  it("caps at 5000 entries by default", () => {
    const store = createStore()

    for (let id = 1; id <= 5001; id++) store.add(entry(id))

    expect(store.snapshot()).toHaveLength(5000)
    expect(store.snapshot()[0].id).toBe(2)
  })

  it("clears entries and keeps accepting new ones", () => {
    const store = createStore()
    store.add(entry(1))
    store.add(entry(2))

    store.clear()
    expect(store.snapshot()).toEqual([])

    store.add(entry(3))
    expect(store.snapshot().map((e) => e.id)).toEqual([3])
  })

  it("notifies subscribers on add and clear until unsubscribed", () => {
    const store = createStore()
    const fn = vi.fn()
    const off = store.subscribe(fn)

    store.add(entry(1))
    store.clear()
    expect(fn).toHaveBeenCalledTimes(2)

    off()
    store.add(entry(2))
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
