import type { Entry } from "../capture/entry"
import { loadBody } from "./body"

type Indexed = Pick<Entry, "getBody" | "mimeType" | "requestBody">

// Keyed by getBody: message appends keep it (no refetch), while a finished
// merge brings a new one, so a live fetch is indexed again once complete.
export function createBodyIndex(onChange: () => void) {
  const texts = new WeakMap<Entry["getBody"], string>()
  const started = new WeakSet<Entry["getBody"]>()
  return {
    sync(entries: readonly Indexed[], on: boolean) {
      if (!on) return
      for (const entry of entries) {
        if (started.has(entry.getBody)) continue
        started.add(entry.getBody)
        void loadBody(entry, { pretty: false }).then((body) => {
          const response = body.view ? "" : body.text
          texts.set(
            entry.getBody,
            `${entry.requestBody?.text ?? ""}\n${response}`,
          )
          onChange()
        })
      }
    },
    text: (entry: Indexed) => texts.get(entry.getBody),
  }
}
