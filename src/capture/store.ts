import type { Entry } from "./entry"

export const DEFAULT_CAP = 5000

export function createStore(cap = DEFAULT_CAP) {
  let entries: readonly Entry[] = []

  return {
    add(entry: Entry) {
      entries = [...entries, entry].slice(-cap)
    },
    snapshot() {
      return entries
    },
  }
}
