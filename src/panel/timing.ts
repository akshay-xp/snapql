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
  ms: number | undefined
  fraction: number
}

export type TimingView = { rows: TimingRow[]; tls: number | undefined }

export function timingView(timings: Timings): TimingView {
  const measured = (phase: keyof Timings) =>
    timings[phase] >= 0 ? timings[phase] : undefined
  const total = phases.reduce((sum, p) => sum + (measured(p) ?? 0), 0)
  const rows = phases.map((phase) => {
    const ms = measured(phase)
    return { phase, ms, fraction: ms && total ? ms / total : 0 }
  })
  return { rows, tls: measured("ssl") }
}
