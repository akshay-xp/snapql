// What src/probe/probe.js records. Ids count per probe install (session).
export type ProbeEvent =
  | {
      type: "open"
      id: number
      kind: "fetch" | "eventsource"
      method: string
      url: string
      status?: number
      mimeType: string
      body?: string
      time: number
    }
  | { type: "chunk"; id: number; time: number; text: string }
  | {
      type: "event"
      id: number
      time: number
      text: string
      event?: string
      lastId?: string
    }
  | { type: "close"; id: number; time: number }

export type Drained = { session: string; events: ProbeEvent[]; dropped: number }

export const DRAIN = 'window[Symbol.for("snapql.probe")]?.drain()'
export const POLL_MS = 250

export type ProbeDeps = {
  evaluate(expression: string): Promise<unknown>
  script(): Promise<string>
  onNavigated(cb: () => void): () => void
  visible(): boolean
}

// The page can't call the panel, so the panel polls. A drain finding no probe
// (new document, or injection lost the race) injects again.
export function pollProbe(
  deps: ProbeDeps,
  cb: (drained: Drained) => void,
): () => void {
  const inject = async () => {
    await deps.evaluate(await deps.script())
  }
  let pending = false
  const tick = async () => {
    if (pending || !deps.visible()) return
    pending = true
    try {
      const drained = (await deps.evaluate(DRAIN)) as Drained | undefined
      if (!drained) await inject()
      else if (drained.events.length) cb(drained)
    } finally {
      pending = false
    }
  }
  inject()
  const offNavigated = deps.onNavigated(() => {
    inject()
  })
  const timer = setInterval(tick, POLL_MS)
  return () => {
    clearInterval(timer)
    offNavigated()
  }
}
