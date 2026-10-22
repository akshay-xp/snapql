import { describe, expect, it } from "vitest"
import { emptyExchange } from "../capture/test-helpers"
import { summaryHeading } from "./heading"

const startedAt = new Date(2026, 9, 22, 9, 5, 7).getTime()
const entry = (
  overrides: Partial<Parameters<typeof summaryHeading>[0]> = {},
  statusText = "OK",
) => ({
  method: "POST",
  url: "https://x.test/graphql?a=1",
  status: 200,
  time: 34.4,
  startedAt,
  exchange: { ...emptyExchange, statusText },
  ...overrides,
})

describe("summaryHeading", () => {
  it("titles, tags and describes a decoded request", () => {
    expect(
      summaryHeading(
        entry({
          decoded: {
            kind: "graphql",
            title: "GetUser",
            detail: "query",
            data: {},
          },
        }),
      ),
    ).toEqual({
      title: "GetUser",
      tag: "graphql query",
      method: "POST",
      path: "/graphql?a=1",
      status: "200 OK",
      ok: true,
      time: "34 ms",
      clock: "09:05:07",
    })
  })

  it("tags by kind alone without a detail, and not at all when undecoded", () => {
    const soap = summaryHeading(
      entry({ decoded: { kind: "soap", title: "GetPrice", data: {} } }),
    )
    expect(soap.tag).toBe("soap")
    const plain = summaryHeading(
      entry({ method: "GET", url: "https://x.test/api/one" }),
    )
    expect(plain.title).toBe("/api/one")
    expect(plain).not.toHaveProperty("tag")
  })

  it("describes failures and bare status codes", () => {
    expect(summaryHeading(entry({ status: 404 }, "Not Found"))).toMatchObject({
      status: "404 Not Found",
      ok: false,
    })
    expect(summaryHeading(entry({ status: 0 }, ""))).toMatchObject({
      status: "failed",
      ok: false,
    })
    expect(summaryHeading(entry({ status: 204 }, "")).status).toBe("204")
  })
})
