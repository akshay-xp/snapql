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
] as const

export type Tab = (typeof TABS)[number]

export function tabsFor(entry: Pick<Entry, "mimeType" | "messages">): Tab[] {
  const streamed = !!entry.messages || !!streamParser(entry.mimeType)
  return TABS.filter((tab) => tab !== "Messages" || streamed)
}

export const shownTab = (active: Tab, tabs: readonly Tab[]): Tab =>
  tabs.includes(active) ? active : "Summary"
