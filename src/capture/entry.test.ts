import { describe, expect, it } from "vitest"
import { type FinishedRequest, toEntry } from "./entry"

function request(overrides: Partial<FinishedRequest> = {}): FinishedRequest {
  return {
    method: "POST",
    url: "https://api.test/graphql",
    status: 200,
    startedDateTime: "2026-10-22T10:00:00.000Z",
    time: 12.5,
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
})
