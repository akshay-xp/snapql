import { describe, expect, it } from "vitest"
import { timingView } from "./timing"

const t = {
  blocked: 1,
  dns: 1,
  connect: 4,
  ssl: 2,
  send: 1,
  wait: 2,
  receive: 1,
}

describe("timingView", () => {
  it("counts TLS inside connect, not on its own", () => {
    const view = timingView(t)
    expect(view.rows.map((r) => r.phase)).toEqual([
      "blocked",
      "dns",
      "connect",
      "send",
      "wait",
      "receive",
    ])
    expect(view.rows.find((r) => r.phase === "connect")?.fraction).toBe(0.4)
    expect(view.tls).toBe(2)
    expect(timingView({ ...t, ssl: -1 }).tls).toBeUndefined()
  })
})
