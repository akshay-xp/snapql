import { describe, expect, it, vi } from "vitest"
import { type FinishedRequest, toEntry } from "./entry"

function request(overrides: Partial<FinishedRequest> = {}): FinishedRequest {
  return {
    method: "POST",
    url: "https://api.test/graphql",
    status: 200,
    startedDateTime: "2026-10-22T10:00:00.000Z",
    time: 12.5,
    mimeType: "",
    fetchBody: () => Promise.resolve({ content: "", encoding: "" }),
    ...overrides,
  }
}

describe("toEntry", () => {
  it("maps request fields", () => {
    const entry = toEntry(request(), 7)

    expect(entry).toMatchObject({
      id: 7,
      method: "POST",
      url: "https://api.test/graphql",
      status: 200,
      startedAt: Date.parse("2026-10-22T10:00:00.000Z"),
      time: 12.5,
    })
  })

  it("fetches the body lazily and only once", async () => {
    const body = { content: "{}", encoding: "" }
    const fetchBody = vi.fn(() => Promise.resolve(body))
    const entry = toEntry(request({ fetchBody }), 1)

    expect(fetchBody).not.toHaveBeenCalled()

    const [first, second] = await Promise.all([
      entry.getBody(),
      entry.getBody(),
    ])

    expect(fetchBody).toHaveBeenCalledTimes(1)
    expect(first).toBe(body)
    expect(second).toBe(body)
  })

  it("carries the response mime type", () => {
    expect(toEntry(request({ mimeType: "text/html" }), 1).mimeType).toBe(
      "text/html",
    )
  })
})
