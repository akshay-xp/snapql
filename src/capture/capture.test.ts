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
  const offNavigated = vi.fn()
  let emit: (req: FinishedRequest) => void = () => {}
  let navigate = () => {}
  const source: CaptureSource = {
    onRequestFinished: (cb) => {
      emit = cb
      return off
    },
    getHAR: () => har,
    onNavigated: (cb) => {
      navigate = cb
      return offNavigated
    },
  }
  return {
    source,
    off,
    offNavigated,
    emit: (req: FinishedRequest) => emit(req),
    navigate: () => navigate(),
  }
}

const urls = (store: ReturnType<typeof createStore>) =>
  store.snapshot().map((e) => [e.id, e.url])

describe("startCapture", () => {
  it("adds finished requests to the store without fetching bodies", async () => {
    const store = createStore()
    const { source, off, emit } = fakeSource()
    const a = request("https://api.test/a")
    const b = request("https://api.test/b")

    const stop = startCapture(source, store, [], () => false)
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

    startCapture(source, store, [fake], () => false)
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

    startCapture(source, store, [fake], () => false)
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

  it("holds live requests until backfill is in and drops duplicates", async () => {
    const store = createStore()
    let resolve: (reqs: FinishedRequest[]) => void = () => {}
    const { source, emit } = fakeSource(new Promise((r) => (resolve = r)))
    const l1 = { ...request("https://api.test/l1"), startedDateTime: "t1" }

    startCapture(source, store, [], () => false)
    emit(l1)
    emit(request("https://api.test/l2"))
    await Promise.resolve()
    expect(store.snapshot()).toEqual([])

    resolve([request("https://api.test/h0"), { ...l1 }])

    await vi.waitFor(() =>
      expect(urls(store)).toEqual([
        [1, "https://api.test/h0"],
        [2, "https://api.test/l1"],
        [3, "https://api.test/l2"],
      ]),
    )
  })

  it("still adds live requests when the HAR read fails", async () => {
    const store = createStore()
    const { source, emit } = fakeSource(Promise.reject(new Error("no HAR")))

    startCapture(source, store, [], () => false)
    emit(request("https://api.test/l1"))

    await vi.waitFor(() =>
      expect(urls(store)).toEqual([[1, "https://api.test/l1"]]),
    )
  })

  it("drops a live copy of a HAR entry that arrives after backfill", async () => {
    const store = createStore()
    const h1 = request("https://api.test/h1")
    const { source, emit } = fakeSource(Promise.resolve([h1]))

    startCapture(source, store, [], () => false)
    await vi.waitFor(() => expect(store.snapshot()).toHaveLength(1))
    emit({ ...h1 })
    emit(request("https://api.test/l1"))

    expect(urls(store)).toEqual([
      [1, "https://api.test/h1"],
      [2, "https://api.test/l1"],
    ])
  })

  it("clears on navigation unless the log is preserved", async () => {
    const store = createStore()
    const { source, off, offNavigated, emit, navigate } = fakeSource()
    let preserve = false

    const stop = startCapture(source, store, [], () => preserve)
    emit(request("https://api.test/a"))
    emit(request("https://api.test/b"))
    await vi.waitFor(() => expect(store.snapshot()).toHaveLength(2))
    navigate()
    expect(store.snapshot()).toEqual([])

    preserve = true
    emit(request("https://api.test/c"))
    navigate()
    expect(urls(store)).toEqual([[3, "https://api.test/c"]])

    stop()
    expect(off).toHaveBeenCalled()
    expect(offNavigated).toHaveBeenCalled()
  })
})
