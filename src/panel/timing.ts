import type { Timings } from "../capture/entry"

const phases: (keyof Timings)[] = [
  "blocked",
  "dns",
  "connect",
  "ssl",
  "send",
  "wait",
  "receive",
]

export type TimingRow = {
  phase: keyof Timings
  ms: number | undefined
  fraction: number
}

export function timingRows(timings: Timings): TimingRow[] {
  const measured = (phase: keyof Timings) =>
    timings[phase] >= 0 ? timings[phase] : undefined
  const total = phases.reduce((sum, p) => sum + (measured(p) ?? 0), 0)
  return phases.map((phase) => {
    const ms = measured(phase)
    return { phase, ms, fraction: ms && total ? ms / total : 0 }
  })
}
