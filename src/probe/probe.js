// SnapQL page probe. Injected by the SnapQL DevTools panel with
// devtools.inspectedWindow.eval, only while the panel is open. It wraps fetch
// and EventSource to record streamed responses as they arrive, and queues the
// records for the panel to collect with drain(). It sends nothing anywhere and
// changes nothing the page can observe.
;((window) => {
  const KEY = Symbol.for("snapql.probe")
  if (window[KEY]) return

  const QUEUE_CAP = 10000
  let queue = []
  let dropped = 0

  const state = {
    session: Math.random().toString(36).slice(2),
    record(event) {
      queue.push(event)
      if (queue.length > QUEUE_CAP) {
        queue.shift()
        dropped++
      }
    },
    drain() {
      const drained = { session: state.session, events: queue, dropped }
      queue = []
      dropped = 0
      return drained
    },
  }
  window[KEY] = state

  // Must match the stream mimes the panel parses (src/decoders/stream.ts).
  const STREAM = /event-stream|ndjson|jsonl|multipart\/mixed/i
  let nextId = 1

  async function readStream(id, res) {
    const reader = res.clone().body.getReader()
    const decoder = new TextDecoder()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        if (text) state.record({ type: "chunk", id, time: Date.now(), text })
      }
    } finally {
      state.record({ type: "close", id, time: Date.now() })
    }
  }

  const fetch = window.fetch
  if (fetch) {
    window.fetch = function (...args) {
      const [input, init] = args
      const promise = fetch.apply(this, args)
      const time = Date.now()
      promise.then(
        (res) => {
          const mimeType = res.headers.get("content-type") || ""
          if (!STREAM.test(mimeType) || !res.body) return
          const request = typeof input === "object" && "url" in input
          const id = nextId++
          state.record({
            type: "open",
            id,
            kind: "fetch",
            method: init?.method || (request && input.method) || "GET",
            url: res.url || (request ? input.url : String(input)),
            status: res.status,
            mimeType,
            body: typeof init?.body === "string" ? init.body : undefined,
            time,
          })
          readStream(id, res).catch(() => {})
        },
        () => {},
      )
      return promise
    }
  }

  // Named events reach only listeners of their own type, so a recorder is
  // added for each type the page listens to (plus "message").
  const EventSource = window.EventSource
  if (EventSource) {
    window.EventSource = class extends EventSource {
      #id = nextId++
      #types = new Set()
      #closed = false

      constructor(...args) {
        super(...args)
        state.record({
          type: "open",
          id: this.#id,
          kind: "eventsource",
          method: "GET",
          url: this.url,
          mimeType: "text/event-stream",
          time: Date.now(),
        })
        super.addEventListener("error", () => {
          if (this.readyState === 2) this.#close()
        })
        this.#listen("message")
      }

      addEventListener(type, ...rest) {
        // The native constructor may add listeners before fields exist.
        if (#types in this) this.#listen(type)
        return super.addEventListener(type, ...rest)
      }

      close() {
        this.#close()
        return super.close()
      }

      #listen(type) {
        if (this.#types.has(type)) return
        this.#types.add(type)
        super.addEventListener(type, (e) =>
          state.record({
            type: "event",
            id: this.#id,
            time: Date.now(),
            text: String(e.data),
            event: type === "message" ? undefined : type,
            lastId: e.lastEventId || undefined,
          }),
        )
      }

      #close() {
        if (this.#closed) return
        this.#closed = true
        state.record({ type: "close", id: this.#id, time: Date.now() })
      }
    }
  }
})(window)
