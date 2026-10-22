import { describe, expect, it } from "vitest"
import { emptyExchange } from "../capture/test-helpers"
import { timingRows } from "./timing"

describe("timingRows", () => {
  it("lists phases in HAR order with a share of the measured total", () => {
    expect(
      timingRows({
        blocked: 1,
        dns: -1,
        connect: -1,
        ssl: -1,
        send: 1,
        wait: 6,
        receive: 2,
      }),
    ).toEqual([
      { phase: "blocked", ms: 1, fraction: 0.1 },
      { phase: "dns", ms: undefined, fraction: 0 },
      { phase: "connect", ms: undefined, fraction: 0 },
      { phase: "ssl", ms: undefined, fraction: 0 },
      { phase: "send", ms: 1, fraction: 0.1 },
      { phase: "wait", ms: 6, fraction: 0.6 },
      { phase: "receive", ms: 2, fraction: 0.2 },
    ])
  })

  it("gives zero shares when nothing was measured", () => {
    expect(timingRows(emptyExchange.timings).map((r) => r.fraction)).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ])
  })
})
