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
})
