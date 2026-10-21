import { describe, expect, it } from "vitest"
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
})
