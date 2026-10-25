import type { Timings } from "../capture/entry"

export type Stage = "setup" | "server" | "download"

type Phase = { phase: keyof Timings; label: string; stage: Stage }

// No ssl: HAR already counts it inside connect.
const phases: Phase[] = [
  { phase: "blocked", label: "Queued", stage: "setup" },
  { phase: "dns", label: "DNS lookup", stage: "setup" },
  { phase: "connect", label: "Connect", stage: "setup" },
  { phase: "send", label: "Request sent", stage: "server" },
  { phase: "wait", label: "Waiting (TTFB)", stage: "server" },
  { phase: "receive", label: "Download", stage: "download" },
]

export type TimingRow = Phase & {
  ms: number
  offset: number
  fraction: number
}

export type TimingView = {
  rows: TimingRow[]
  tls: number | undefined
  reused: boolean
  stages: { stage: Stage; ms: number; fraction: number }[]
  summary: string | undefined
}

const doing: Record<Stage, string> = {
  setup: "connection setup",
  server: "waiting for the server",
  download: "downloading",
}

export function timingView(timings: Timings): TimingView {
  const has = (phase: keyof Timings) => timings[phase] >= 0
  const shown = phases.filter((p) => has(p.phase))
  const total = shown.reduce((sum, p) => sum + timings[p.phase], 0)
  let offset = 0
  const rows = shown.map((p) => {
    const ms = timings[p.phase]
    const row = { ...p, ms, offset, fraction: total ? ms / total : 0 }
    offset += row.fraction
    return row
  })
  const stages = (Object.keys(doing) as Stage[])
    .map((stage) => {
      const inStage = rows.filter((r) => r.stage === stage)
      const sum = (pick: (r: TimingRow) => number) =>
        inStage.reduce((total, r) => total + pick(r), 0)
      return { stage, ms: sum((r) => r.ms), fraction: sum((r) => r.fraction) }
    })
    .filter((s) => s.fraction > 0)
  const top = [...stages].sort((a, b) => b.fraction - a.fraction)[0]
  return {
    rows,
    stages,
    summary:
      top && `mostly ${doing[top.stage]} (${Math.round(top.fraction * 100)}%)`,
    tls: has("ssl") ? timings.ssl : undefined,
    reused: !has("dns") && !has("connect"),
  }
}
