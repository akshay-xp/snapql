import type { Entry } from "../capture/entry"
import { loadBody } from "./body"

type Indexed = Pick<Entry, "getBody" | "mimeType" | "requestBody">

export type BodyTexts = { request: string; response: string }

// Keyed by getBody: message appends keep it (no refetch), while a finished
// merge brings a new one, so a live fetch is indexed again once complete.
export function createBodyIndex(onChange: () => void) {
  const texts = new WeakMap<Entry["getBody"], BodyTexts>()
  const started = new WeakSet<Entry["getBody"]>()
  return {
    sync(entries: readonly Indexed[], on: boolean) {
      if (!on) return
      for (const entry of entries) {
        if (started.has(entry.getBody)) continue
        started.add(entry.getBody)
        void loadBody(entry, { pretty: false }).then((body) => {
          texts.set(entry.getBody, {
            request: entry.requestBody?.text ?? "",
            response: body.view ? "" : body.text,
          })
          onChange()
        })
      }
    },
    text: (entry: Indexed) => texts.get(entry.getBody),
  }
}
