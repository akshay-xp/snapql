import type { Entry } from "../capture/entry"
import { streamParser } from "../decoders/stream"

const TABS = [
  "Summary",
  "Body",
  "Messages",
  "Headers",
  "Params/Cookies",
  "Timing",
  "Raw",
  "Diff",
] as const

export type Tab = (typeof TABS)[number]

export function tabsFor(
  entry: Pick<Entry, "mimeType" | "messages" | "socket">,
  diffing = false,
): Tab[] {
  const diff: Tab[] = diffing ? ["Diff"] : []
  // A socket has no body, params or timing; Headers holds its handshake.
  if (entry.socket) return ["Summary", "Messages", "Headers", ...diff]
  const streamed = !!entry.messages || !!streamParser(entry.mimeType)
  return TABS.filter(
    (tab) => (tab !== "Messages" || streamed) && (tab !== "Diff" || diffing),
  )
}

export const shownTab = (active: Tab, tabs: readonly Tab[]): Tab =>
  tabs.includes(active) ? active : "Summary"
