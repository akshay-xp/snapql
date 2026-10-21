import { describe, expect, it, vi } from "vitest"
import { startCapture } from "./capture"
import type { FinishedRequest } from "./entry"
import { createStore } from "./store"

function request(url: string): FinishedRequest {
  return {
    method: "GET",
    url,
    status: 200,
    startedDateTime: "2026-10-22T10:00:00.000Z",
    time: 1,
    fetchBody: vi.fn(() => Promise.resolve({ content: "", encoding: "" })),
  }
}

describe("startCapture", () => {
  it("adds finished requests to the store without fetching bodies", () => {
    const store = createStore()
    const off = vi.fn()
    let emit: (req: FinishedRequest) => void = () => {}
    const subscribe = (cb: (req: FinishedRequest) => void) => {
      emit = cb
      return off
    }
    const a = request("https://api.test/a")
    const b = request("https://api.test/b")

    const stop = startCapture(subscribe, store)
    emit(a)
    emit(b)

    expect(store.snapshot().map((e) => [e.id, e.url])).toEqual([
      [1, "https://api.test/a"],
      [2, "https://api.test/b"],
    ])
    expect(a.fetchBody).not.toHaveBeenCalled()
    expect(b.fetchBody).not.toHaveBeenCalled()

    stop()
    expect(off).toHaveBeenCalled()
  })
})
