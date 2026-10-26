import { describe, expect, it } from "vitest"
import { shownTab, tabsFor } from "./tabs"

describe("tabsFor", () => {
  it("groups tabs by direction, with Messages after Response for streams", () => {
    expect(tabsFor({ mimeType: "text/event-stream" })).toEqual([
      "Summary",
      "Payload",
      "Response",
      "Messages",
      "Headers",
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
})
