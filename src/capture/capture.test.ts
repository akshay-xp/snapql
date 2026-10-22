import { describe, expect, it, vi } from "vitest"
import type { Decoder } from "../decoders/types"
import { type CaptureSource, startCapture } from "./capture"
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

function fakeSource(har: Promise<FinishedRequest[]> = Promise.resolve([])) {
  const off = vi.fn()
  let emit: (req: FinishedRequest) => void = () => {}
  const source: CaptureSource = {
    onRequestFinished: (cb) => {
      emit = cb
      return off
    },
    getHAR: () => har,
  }
  return { source, off, emit: (req: FinishedRequest) => emit(req) }
}

const urls = (store: ReturnType<typeof createStore>) =>
  store.snapshot().map((e) => [e.id, e.url])

describe("startCapture", () => {
  it("adds finished requests to the store without fetching bodies", async () => {
    const store = createStore()
    const { source, off, emit } = fakeSource()
    const a = request("https://api.test/a")
    const b = request("https://api.test/b")

    const stop = startCapture(source, store, [])
    emit(a)
    emit(b)

    await vi.waitFor(() =>
      expect(urls(store)).toEqual([
        [1, "https://api.test/a"],
        [2, "https://api.test/b"],
      ]),
    )
    expect(a.fetchBody).not.toHaveBeenCalled()
    expect(b.fetchBody).not.toHaveBeenCalled()

    stop()
    expect(off).toHaveBeenCalled()
  })

  it("stores each request's decode result", async () => {
    const store = createStore()
    const { source, emit } = fakeSource()
    const fake: Decoder = {
      kind: "fake",
      decode: (req) =>
        req.url.endsWith("/a") ? { summary: "a", data: null } : undefined,
    }
    const a = request("https://api.test/a")

    startCapture(source, store, [fake])
    emit(a)
    emit(request("https://api.test/b"))

    await vi.waitFor(() =>
      expect(store.snapshot().map((e) => e.decoded)).toEqual([
        { kind: "fake", summary: "a", data: null },
        undefined,
      ]),
    )
    expect(a.fetchBody).not.toHaveBeenCalled()
  })

  it("backfills HAR entries before later live requests", async () => {
    const store = createStore()
    const { source, emit } = fakeSource(
      Promise.resolve([
        request("https://api.test/h1"),
        request("https://api.test/h2"),
      ]),
    )
    const fake: Decoder = {
      kind: "fake",
      decode: () => ({ summary: "s", data: null }),
    }

    startCapture(source, store, [fake])
    await vi.waitFor(() =>
      expect(urls(store)).toEqual([
        [1, "https://api.test/h1"],
        [2, "https://api.test/h2"],
      ]),
    )
    emit(request("https://api.test/live"))

    expect(urls(store)[2]).toEqual([3, "https://api.test/live"])
    expect(store.snapshot()[0].decoded?.kind).toBe("fake")
  })
})
