import { describe, expect, it } from "vitest"
import { emptyExchange } from "../capture/test-helpers"
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

  const reused = {
    blocked: 1,
    dns: -1,
    connect: -1,
    ssl: -1,
    send: 1,
    wait: 6,
    receive: 2,
  }

  it("starts each measured phase where the previous one ended", () => {
    const view = timingView(reused)
    expect(
      view.rows.map(({ phase, offset, fraction }) => ({
        phase,
        offset: Math.round(offset * 10) / 10,
        fraction,
      })),
    ).toEqual([
      { phase: "blocked", offset: 0, fraction: 0.1 },
      { phase: "send", offset: 0.1, fraction: 0.1 },
      { phase: "wait", offset: 0.2, fraction: 0.6 },
      { phase: "receive", offset: 0.8, fraction: 0.2 },
    ])
    expect(view.reused).toBe(true)
    expect(timingView({ ...reused, dns: 3 }).reused).toBe(false)
  })

  it("labels each phase in plain words with its stage", () => {
    expect(
      timingView(t).rows.map(({ phase, label, stage }) => [
        phase,
        label,
        stage,
      ]),
    ).toEqual([
      ["blocked", "Queued", "setup"],
      ["dns", "DNS lookup", "setup"],
      ["connect", "Connect", "setup"],
      ["send", "Request sent", "server"],
      ["wait", "Waiting (TTFB)", "server"],
      ["receive", "Download", "download"],
    ])
  })

  it("has no rows when nothing was measured", () => {
    expect(timingView(emptyExchange.timings)).toMatchObject({
      rows: [],
      reused: true,
    })
  })
})
