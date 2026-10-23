import { describe, expect, it } from "vitest"
import { shownTab, tabsFor } from "./tabs"

describe("tabsFor", () => {
  it("adds Messages after Body for streams and entries with messages", () => {
    expect(tabsFor({ mimeType: "text/event-stream" })).toEqual([
      "Summary",
      "Body",
      "Messages",
      "Headers",
      "Params/Cookies",
      "Timing",
      "Raw",
    ])
    expect(tabsFor({ mimeType: "", messages: [] })).toContain("Messages")
    expect(tabsFor({ mimeType: "application/json" })).not.toContain("Messages")
  })

  it("falls back to Summary when the active tab is hidden", () => {
    const tabs = tabsFor({ mimeType: "application/json" })
    expect(shownTab("Messages", tabs)).toBe("Summary")
    expect(shownTab("Raw", tabs)).toBe("Raw")
  })

  it("shows only socket-relevant tabs for WebSockets", () => {
    expect(
      tabsFor({ mimeType: "", messages: [], socket: { protocol: "" } }),
    ).toEqual(["Summary", "Messages", "Headers"])
  })

  it("adds Diff only while comparing", () => {
    expect(tabsFor({ mimeType: "application/json" }, true).at(-1)).toBe("Diff")
    expect(tabsFor({ mimeType: "application/json" })).not.toContain("Diff")
    expect(
      tabsFor({ mimeType: "", messages: [], socket: { protocol: "" } }, true),
    ).toEqual(["Summary", "Messages", "Headers", "Diff"])
  })
})
