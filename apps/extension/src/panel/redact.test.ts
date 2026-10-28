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

const b64url = (o: object) =>
  btoa(JSON.stringify(o))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
const jwt = `${b64url({ alg: "HS256" })}.${b64url({ sub: "1" })}.sig`

describe("redactHar: bodies and JWTs", () => {
  it("redacts secret form fields", () => {
    const entry = one(
      harOf({
        method: "POST",
        requestBody: {
          mimeType: "application/x-www-form-urlencoded",
          text: "password=hunter2&user=ada",
        },
      }),
    )
    expect(entry.request.postData?.text).toBe(`password=${R}&user=ada`)
  })

  it("redacts secret JSON keys at any depth", () => {
    const entry = one(
      harOf(
        {},
        {
          content: '{"user":{"secret":"s","name":"Ada"},"list":[{"apiKey":1}]}',
          encoding: "",
        },
      ),
    )
    expect(entry.response.content.text).toBe(
      `{"user":{"secret":"${R}","name":"Ada"},"list":[{"apiKey":"${R}"}]}`,
    )
  })

  it("redacts JWTs in bodies, URLs, headers and text frames", () => {
    const entry = one(
      harOf(
        {
          url: `http://127.0.0.1:8080/u/${jwt}`,
          mimeType: "text/plain",
          exchange: {
            ...emptyExchange,
            requestHeaders: [nv("x-trace", jwt)],
          },
          socket: { protocol: "" },
          messages: [
            { dir: "in", time: 0, text: `{"t":"${jwt}"}` },
            { dir: "in", time: 0, text: "", bytes: 2, base64: "AQI=" },
          ],
        },
        { content: `see ${jwt} here`, encoding: "" },
      ),
    )
    expect(entry.response.content.text).toBe(`see ${R} here`)
    expect(entry.request.url).toBe(`http://127.0.0.1:8080/u/${R}`)
    expect(entry.request.headers).toEqual([nv("x-trace", R)])
    expect(entry._webSocketMessages?.map((m) => m.data)).toEqual([
      `{"t":"${R}"}`,
      "AQI=",
    ])
  })

  it("leaves base64 bodies alone", () => {
    const content = { content: "c2VjcmV0", encoding: "base64" }
    expect(
      one(harOf({ mimeType: "image/png" }, content)).response.content.text,
    ).toBe("c2VjcmV0")
  })
})
