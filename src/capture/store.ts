import type { Entry } from "./entry"

export function createStore() {
  let entries: readonly Entry[] = []

  return {
    add(entry: Entry) {
      entries = [...entries, entry]
    },
    snapshot() {
      return entries
    },
  }
}
