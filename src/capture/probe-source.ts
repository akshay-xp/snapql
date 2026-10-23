// What src/probe/probe.js records. Ids count per probe install (session).
export type ProbeEvent =
  | {
      type: "open"
      id: number
      kind: "fetch" | "eventsource" | "websocket"
      method: string
      url: string
      status?: number
      mimeType: string
      body?: string
      protocols?: string[]
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
  | { type: "ready"; id: number; time: number; protocol: string }
  | {
      type: "frame"
      id: number
      time: number
      dir: "in" | "out"
      text: string
      bytes?: number
    }
  | { type: "close"; id: number; time: number; code?: number; reason?: string }

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
