import { describe, expect, it } from "vitest"
import { emptyExchange, type NameValue } from "../capture/entry"
import { failureOf } from "./failure"

const h = (name: string, value: string): NameValue => ({ name, value })
const served = [h("Content-Type", "application/json")]

const entry = (over: {
  url?: string
  status?: number
  error?: string
  request?: NameValue[]
  response?: NameValue[]
}) => ({
  url: over.url ?? "http://b.test/x",
  status: over.status ?? 200,
  exchange: {
    ...emptyExchange,
    error: over.error,
    requestHeaders: over.request ?? [],
    responseHeaders: over.response ?? [],
  },
})

const blocked = (over: Parameters<typeof entry>[0]) =>
  failureOf(
    entry({
      error: "net::ERR_FAILED",
      request: [h("Origin", "http://a.test")],
      ...over,
    }),
  )

describe("failureOf", () => {
  it("names a CORS error when the response does not allow the origin", () => {
    expect(blocked({ response: served })).toBe("CORS error")
    expect(
      blocked({
        response: [
          ...served,
          h("Access-Control-Allow-Origin", "http://other.test"),
        ],
      }),
    ).toBe("CORS error")
  })

  it("does not blame CORS when the origin was allowed", () => {
    for (const allowed of ["*", "http://a.test"])
      expect(
        blocked({
          response: [...served, h("access-control-allow-origin", allowed)],
        }),
      ).toBe("ERR_FAILED")
  })

  it("says probably CORS when no response came back", () => {
    expect(blocked({ status: 0 })).toBe("probably CORS")
    expect(
      blocked({ status: 0, request: [h("referer", "http://a.test/page")] }),
    ).toBe("probably CORS")
  })

  it("shows the raw error when it can't be CORS", () => {
    expect(blocked({ url: "http://a.test/x", status: 0 })).toBe("ERR_FAILED")
    expect(blocked({ status: 0, request: [] })).toBe("ERR_FAILED")
    expect(blocked({ status: 0, error: "net::ERR_CONNECTION_REFUSED" })).toBe(
      "ERR_CONNECTION_REFUSED",
    )
  })

  it("falls back to the status without an error", () => {
    expect(failureOf(entry({ status: 0 }))).toBe("failed")
    expect(failureOf(entry({ status: 404 }))).toBe("404")
    expect(failureOf(entry({ status: 200 }))).toBeUndefined()
  })
})
