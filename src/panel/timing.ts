import type { Timings } from "../capture/entry"

// No ssl: HAR already counts it inside connect.
const phases: (keyof Timings)[] = [
  "blocked",
  "dns",
  "connect",
  "send",
  "wait",
  "receive",
]

export type TimingRow = {
  phase: keyof Timings
  ms: number
  offset: number
  fraction: number
}

export type TimingView = {
  rows: TimingRow[]
  tls: number | undefined
  reused: boolean
}

export function timingView(timings: Timings): TimingView {
  const has = (phase: keyof Timings) => timings[phase] >= 0
  const shown = phases.filter(has)
  const total = shown.reduce((sum, p) => sum + timings[p], 0)
  let offset = 0
  const rows = shown.map((phase) => {
    const ms = timings[phase]
    const row = { phase, ms, offset, fraction: total ? ms / total : 0 }
    offset += row.fraction
    return row
  })
  return {
    rows,
    tls: has("ssl") ? timings.ssl : undefined,
    reused: !has("dns") && !has("connect"),
  }
}
