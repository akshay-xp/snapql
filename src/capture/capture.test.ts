import { describe, expect, it, vi } from "vitest"
import { decoders } from "../decoders"
import type { Decoder } from "../decoders/types"
import { type CaptureSource, startCapture } from "./capture"
import type { FinishedRequest } from "./entry"
import type { Drained, ProbeEvent } from "./probe-source"
import { createStore } from "./store"
import { emptyExchange } from "./test-helpers"

function request(url: string): FinishedRequest {
  return {
    method: "GET",
    url,
    status: 200,
    startedDateTime: "2026-10-22T10:00:00.000Z",
    time: 1,
    mimeType: "",
    exchange: emptyExchange,
    fetchBody: vi.fn(() => Promise.resolve({ content: "", encoding: "" })),
  }
}

function fakeSource(har: Promise<FinishedRequest[]> = Promise.resolve([])) {
  const off = vi.fn()
  const offNavigated = vi.fn()
  let emit: (req: FinishedRequest) => void = () => {}
  let navigate = () => {}
  let probe: (d: Drained) => void = () => {}
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
    onProbe: (cb) => {
      probe = cb
      return () => {}
    },
  }
  return {
    source,
    off,
    offNavigated,
    emit: (req: FinishedRequest) => emit(req),
    navigate: () => navigate(),
    probe: (events: ProbeEvent[], session = "s") =>
      probe({ session, events, dropped: 0 }),
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
        req.url.endsWith("/a") ? { title: "a", data: null } : undefined,
    }
    const a = request("https://api.test/a")

    startCapture(source, store, [fake], () => false)
    emit(a)
    emit(request("https://api.test/b"))

    await vi.waitFor(() =>
      expect(store.snapshot().map((e) => e.decoded)).toEqual([
        { kind: "fake", title: "a", data: null },
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
      decode: () => ({ title: "s", data: null }),
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

describe("live capture", () => {
  const open = (over: Partial<ProbeEvent & { type: "open" }> = {}) =>
    ({
      type: "open",
      id: 1,
      kind: "fetch",
      method: "POST",
      url: "https://api.test/v1/chat",
      status: 200,
      mimeType: "text/event-stream",
      body: '{"model":"m","messages":[],"stream":true}',
      time: 1000,
      ...over,
    }) as ProbeEvent

  const live = () => {
    const store = createStore()
    const fake = fakeSource()
    startCapture(fake.source, store, decoders, () => false)
    return { store, ...fake }
  }

  it("opens a decoded live entry from the shared id counter", async () => {
    const { store, probe } = live()
    probe([open()])

    const [entry] = store.snapshot()
    expect(entry).toMatchObject({
      id: 1,
      method: "POST",
      url: "https://api.test/v1/chat",
      status: 200,
      startedAt: 1000,
      mimeType: "text/event-stream",
      open: true,
      messages: [],
    })
    expect(entry.decoded?.kind).toBe("llm")
    await expect(entry.getBody()).resolves.toEqual({
      content: "",
      encoding: "",
    })
  })

  it("parses chunks into timed messages and keeps the raw body", async () => {
    const { store, probe } = live()
    probe([
      open(),
      { type: "chunk", id: 1, time: 1001, text: "data: a\n\nda" },
      { type: "chunk", id: 1, time: 1002, text: "ta: b\n\n" },
    ])

    const [entry] = store.snapshot()
    expect(entry.messages).toEqual([
      { dir: "in", time: 1001, text: "a" },
      { dir: "in", time: 1002, text: "b" },
    ])
    await expect(entry.getBody()).resolves.toEqual({
      content: "data: a\n\ndata: b\n\n",
      encoding: "",
    })
  })

  it("appends EventSource events and closes, flushing the parser", () => {
    const { store, probe } = live()
    probe([
      open({ kind: "eventsource", method: "GET", body: undefined }),
      {
        type: "event",
        id: 1,
        time: 1001,
        text: "x",
        event: "ping",
        lastId: "7",
      },
    ])
    expect(store.snapshot()[0].messages).toEqual([
      { dir: "in", time: 1001, text: "x", event: "ping", id: "7" },
    ])

    probe([
      open({ id: 2 }),
      { type: "chunk", id: 2, time: 1003, text: "data: tail" },
      { type: "close", id: 2, time: 1004 },
    ])
    const entry = store.snapshot()[1]
    expect(entry.open).toBe(false)
    expect(entry.messages).toEqual([{ dir: "in", time: 1004, text: "tail" }])
  })

  it("keeps probe ids from different sessions apart", () => {
    const { store, probe } = live()
    probe([open()], "a")
    probe([open()], "b")
    expect(store.snapshot().map((e) => e.id)).toEqual([1, 2])
  })
})
