import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DRAIN, type Drained, POLL_MS, pollProbe } from "./probe-source"

const drained = (events: unknown[]): Drained =>
  ({ session: "s", events, dropped: 0 }) as Drained

function setup(results: (Drained | undefined)[] = []) {
  let navigate = () => {}
  const offNavigated = vi.fn()
  let shown = true
  const evaluate = vi.fn(async (expr: string) =>
    expr === DRAIN ? results.shift() : undefined,
  )
  const cb = vi.fn()
  const stop = pollProbe(
    {
      evaluate,
      script: async () => "PROBE",
      onNavigated: (fn) => {
        navigate = fn
        return offNavigated
      },
      visible: () => shown,
    },
    cb,
  )
  const injects = () =>
    evaluate.mock.calls.filter(([e]) => e === "PROBE").length
  const drains = () => evaluate.mock.calls.filter(([e]) => e === DRAIN).length
  return {
    cb,
    stop,
    offNavigated,
    injects,
    drains,
    evaluate,
    navigate: () => navigate(),
    hide: () => {
      shown = false
    },
  }
}

describe("pollProbe", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("injects at start and passes on drains that have events", async () => {
    const empty = drained([])
    const full = drained([{ type: "close", id: 1, time: 0 }])
    const t = setup([empty, full])
    await vi.advanceTimersByTimeAsync(0)
    expect(t.injects()).toBe(1)

    await vi.advanceTimersByTimeAsync(POLL_MS * 2)
    expect(t.drains()).toBe(2)
    expect(t.cb).toHaveBeenCalledExactlyOnceWith(full)
  })

  it("does not drain while hidden", async () => {
    const t = setup()
    t.hide()
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(t.drains()).toBe(0)
  })

  it("re-injects when the probe is gone or the page navigates", async () => {
    const t = setup([undefined])
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(t.injects()).toBe(2)
    t.navigate()
    await vi.advanceTimersByTimeAsync(0)
    expect(t.injects()).toBe(3)
  })

  it("skips a tick while a drain is pending", async () => {
    const t = setup()
    let release = (_: Drained) => {}
    t.evaluate.mockImplementation((expr: string) =>
      expr === DRAIN
        ? new Promise<Drained>((r) => {
            release = r
          })
        : Promise.resolve(undefined),
    )
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(t.drains()).toBe(1)
    release(drained([]))
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(t.drains()).toBe(2)
  })

  it("stops polling and listening", async () => {
    const t = setup()
    t.stop()
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(t.drains()).toBe(0)
    expect(t.offNavigated).toHaveBeenCalled()
  })
})
