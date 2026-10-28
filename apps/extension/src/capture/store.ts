import type { Entry } from "./entry"

export const DEFAULT_CAP = 5000

export function createStore(cap = DEFAULT_CAP) {
  let entries: readonly Entry[] = []
  const listeners = new Set<() => void>()

  function set(next: readonly Entry[]) {
    entries = next
    for (const fn of listeners) fn()
  }

  return {
    add(entry: Entry) {
      set([...entries, entry].slice(-cap))
    },
    update(id: number, fn: (entry: Entry) => Entry) {
      const index = entries.findIndex((e) => e.id === id)
      if (index === -1) return
      set(entries.map((e, i) => (i === index ? fn(e) : e)))
    },
    clear() {
      set([])
    },
    snapshot() {
      return entries
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}

export type Store = ReturnType<typeof createStore>
