import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const text = readFileSync(new URL("./probe.js", import.meta.url), "utf8")
const KEY = Symbol.for("snapql.probe")

type Drained = { session: string; events: unknown[]; dropped: number }
type State = { record(event: unknown): void; drain(): Drained }

// The real shipped text, run against fake page globals.
function run(win: Record<PropertyKey, unknown>) {
  new Function("window", text)(win)
  return win[KEY] as State
}

describe("probe", () => {
  it("installs once", () => {
    const fetch = () => Promise.resolve(new Response(""))
    const win: Record<PropertyKey, unknown> = { fetch }
    const state = run(win)
    const wrapped = win.fetch
    expect(wrapped).not.toBe(fetch)
    expect(run(win)).toBe(state)
    expect(win.fetch).toBe(wrapped)
  })

  it("drains recorded events once", () => {
    const state = run({})
    for (const n of [1, 2, 3]) state.record({ n })
    const drained = state.drain()
    expect(drained.session).toMatch(/\w+/)
    expect(drained).toMatchObject({
      events: [{ n: 1 }, { n: 2 }, { n: 3 }],
      dropped: 0,
    })
    expect(state.drain().events).toEqual([])
  })

  it("keeps the newest 10000 events and counts the rest", () => {
    const state = run({})
    for (let n = 0; n < 10002; n++) state.record({ n })
    const { events, dropped } = state.drain()
    expect(events).toHaveLength(10000)
    expect(events[0]).toEqual({ n: 2 })
    expect(dropped).toBe(2)
  })

  describe("fetch", () => {
    const streamed = (chunks: string[], type: string) =>
      new Response(
        new ReadableStream({
          start(c) {
            for (const chunk of chunks)
              c.enqueue(new TextEncoder().encode(chunk))
            c.close()
          },
        }),
        { status: 200, headers: { "content-type": type } },
      )

    const settle = () => new Promise((r) => setTimeout(r, 20))

    it("records streamed responses and leaves the body to the page", async () => {
      const chunks = ["data: a\n\n", "data: b\n\n"]
      const win: Record<PropertyKey, unknown> = {
        fetch: async () => streamed(chunks, "text/event-stream"),
      }
      const state = run(win)
      const fetch = win.fetch as typeof globalThis.fetch

      const res = await fetch("/s", { method: "POST", body: '{"x":1}' })
      expect(await res.text()).toBe(chunks.join(""))
      await settle()

      const { events } = state.drain()
      expect(events).toHaveLength(4)
      expect(events[0]).toMatchObject({
        type: "open",
        id: 1,
        kind: "fetch",
        method: "POST",
        url: "/s",
        status: 200,
        mimeType: "text/event-stream",
        body: '{"x":1}',
      })
      expect((events[0] as { time: number }).time).toBeTypeOf("number")
      expect(events.slice(1)).toMatchObject([
        { type: "chunk", id: 1, text: chunks[0] },
        { type: "chunk", id: 1, text: chunks[1] },
        { type: "close", id: 1 },
      ])
    })

    it("ignores other responses and reads Request inputs", async () => {
      let type = "application/json"
      const win: Record<PropertyKey, unknown> = {
        fetch: async () => streamed(["x"], type),
      }
      const state = run(win)
      const fetch = win.fetch as typeof globalThis.fetch

      await fetch("/j")
      await settle()
      expect(state.drain().events).toEqual([])

      type = "application/x-ndjson"
      await fetch(new Request("http://x.test/n", { method: "PUT" }))
      await settle()
      expect(state.drain().events[0]).toMatchObject({
        method: "PUT",
        url: "http://x.test/n",
      })
    })
  })
})
