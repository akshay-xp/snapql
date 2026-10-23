import { describe, expect, it } from "vitest"
import { type Body, type Entry, emptyExchange } from "../capture/entry"
import { type Har, toHar } from "./har"
import { redactHar } from "./redact"

const nv = (name: string, value: string) => ({ name, value })
const R = "[redacted]"

const base: Entry = {
  id: 1,
  method: "GET",
  url: "https://x.test/p",
  status: 200,
  startedAt: 0,
  time: 1,
  mimeType: "application/json",
  exchange: emptyExchange,
  getBody: () => Promise.reject(new Error("unused")),
}

const harOf = (entry: Partial<Entry>, body?: Body): Har =>
  toHar([{ ...base, ...entry }], [body], "1")

const one = (har: Har) => redactHar(har).log.entries[0]
const values = (pairs: { name: string; value: string }[]) =>
  Object.fromEntries(pairs.map((p) => [p.name, p.value]))

describe("redactHar: headers, cookies, query", () => {
  const input = harOf({
    url: "https://x.test/p?token=abc&x=a%20b",
    exchange: {
      ...emptyExchange,
      requestHeaders: [
        nv("Authorization", "Bearer t"),
        nv("Cookie", "sid=1"),
        nv("x-api-key", "k"),
        nv("X-Session-Id", "s"),
        nv(":authority", "x.test"),
        nv("accept", "*/*"),
      ],
      responseHeaders: [
        nv("Set-Cookie", "theme=dark"),
        nv("content-type", "application/json"),
      ],
      requestCookies: [nv("sid", "1")],
      responseCookies: [nv("theme", "dark")],
      queryString: [nv("token", "abc"), nv("x", "a b")],
    },
  })
  const entry = one(input)

  it("redacts auth, cookie and secret-named headers", () => {
    expect(values(entry.request.headers)).toEqual({
      Authorization: R,
      Cookie: R,
      "x-api-key": R,
      "X-Session-Id": R,
      ":authority": "x.test",
      accept: "*/*",
    })
    expect(values(entry.response.headers)).toEqual({
      "Set-Cookie": R,
      "content-type": "application/json",
    })
  })

  it("redacts every cookie value", () => {
    expect(entry.request.cookies).toEqual([nv("sid", R)])
    expect(entry.response.cookies).toEqual([nv("theme", R)])
  })

  it("redacts secret query params in queryString and url", () => {
    expect(entry.request.queryString).toEqual([nv("token", R), nv("x", "a b")])
    expect(entry.request.url).toBe(`https://x.test/p?token=${R}&x=a%20b`)
    expect(input.log.entries[0].request.url).toContain("token=abc")
  })
})
