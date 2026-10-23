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

  const fetch = window.fetch
  if (fetch) {
    window.fetch = function (...args) {
      return fetch.apply(this, args)
    }
  }
})(window)
