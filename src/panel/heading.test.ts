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
      url: "https://x.test/graphql",
      query: "?a=1",
      status: "200 OK",
      ok: true,
      time: "34 ms",
      clock: "09:05:07",
    })
  })

  it("leaves the URL as the title when undecoded, untagged", () => {
    const plain = summaryHeading(
      entry({ method: "GET", url: "https://x.test/api/one" }),
    )
    expect(plain).not.toHaveProperty("title")
    expect(plain).not.toHaveProperty("tag")
    expect(plain).toMatchObject({ url: "https://x.test/api/one", query: "" })
  })

  it("tags by kind alone, dropping a detail that repeats the method", () => {
    const soap = summaryHeading(
      entry({ decoded: { kind: "soap", title: "GetPrice", data: {} } }),
    )
    expect(soap.tag).toBe("soap")
    const json = summaryHeading(
      entry({
        method: "GET",
        decoded: { kind: "json", title: "/api/me", detail: "GET", data: {} },
      }),
    )
    expect(json.tag).toBe("json")
  })

  it("leaves the URL as the title when the decoder titles by path", () => {
    const json = summaryHeading(
      entry({
        url: "https://x.test/api/me",
        decoded: { kind: "json", title: "/api/me", data: {} },
      }),
    )
    expect(json).not.toHaveProperty("title")
    expect(json.tag).toBe("json")
  })

  it("names the status when the browser gives no text (HTTP/2 and later)", () => {
    expect(summaryHeading(entry({ status: 404 }, "Not Found"))).toMatchObject({
      status: "404 Not Found",
      ok: false,
    })
    expect(summaryHeading(entry({ status: 404 }, "")).status).toBe(
      "404 Not Found",
    )
    expect(summaryHeading(entry({ status: 204 }, "")).status).toBe(
      "204 No Content",
    )
    expect(summaryHeading(entry({ status: 299 }, "")).status).toBe("299")
    expect(summaryHeading(entry({ status: 0 }, ""))).toMatchObject({
      status: "failed",
      ok: false,
    })
  })

  it("describes how a socket closed", () => {
    const socket = (closeCode?: number) =>
      summaryHeading(
        entry(
          { method: "WS", status: 101, socket: { protocol: "", closeCode } },
          "",
        ),
      )
    expect(socket()).toMatchObject({
      status: "101 Switching Protocols",
      ok: true,
    })
    expect(socket(1000)).toMatchObject({ status: "closed 1000", ok: true })
    expect(socket(1005).ok).toBe(true)
    expect(socket(1006)).toMatchObject({ status: "closed 1006", ok: false })
  })

  it("adds size, protocol, remote address and cache source when known", () => {
    const full = summaryHeading(
      entry({
        exchange: {
          ...emptyExchange,
          size: 1234,
          httpVersion: "h2",
          remoteAddress: "10.0.0.1",
          fromCache: "disk",
        },
      }),
    )
    expect(full).toMatchObject({
      size: "1.2 kB",
      protocol: "h2",
      remote: "10.0.0.1",
      cache: "disk cache",
    })
    const empty = summaryHeading(
      entry({ exchange: { ...emptyExchange, size: 0 } }),
    )
    for (const key of ["size", "protocol", "remote", "cache"])
      expect(empty).not.toHaveProperty(key)
  })
})
