import { describe, expect, it } from "vitest"
import { decodeJwt, decodeValue, findTokens } from "./values"

const b64url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const jwt = (header: unknown, payload: unknown, signature = "sig") =>
  [JSON.stringify(header), JSON.stringify(payload)]
    .map(b64url)
    .concat(signature)
    .join(".")

const header = { alg: "HS256", typ: "JWT" }

describe("decodeJwt", () => {
  it("decodes header, payload and expiry", () => {
    const payload = { sub: "42", name: "Ada", exp: 2000000000 }
    expect(decodeJwt(jwt(header, payload))).toEqual({
      header,
      payload,
      expires: "2033-05-18T03:33:20.000Z",
    })
  })

  it("decodes base64url UTF-8 and omits a missing expiry", () => {
    const payload = { name: "é~~~???>>>" }
    const token = jwt(header, payload)
    expect(token).toMatch(/[-_]/)
    expect(decodeJwt(token)).toEqual({ header, payload })
  })

  it("accepts an empty signature", () => {
    expect(decodeJwt(jwt({ alg: "none" }, {}, ""))?.header).toEqual({
      alg: "none",
    })
  })

  it("rejects anything else", () => {
    for (const value of [
      `${b64url("{}")}.${b64url("{}")}`,
      "abc",
      jwt({ typ: "JWT" }, {}),
      `${b64url("nope")}.${b64url("{}")}.sig`,
      `${b64url(JSON.stringify(header))}.${b64url("nope")}.sig`,
      jwt(header, [1]),
    ])
      expect(decodeJwt(value)).toBeUndefined()
  })
})

describe("findTokens", () => {
  const token = jwt(header, { sub: "42" })
  const decoded = decodeJwt(token)
  const pair = (name: string, value: string) => ({ name, value })

  it("finds JWTs in the Authorization header, cookies and query", () => {
    expect(
      findTokens({
        requestHeaders: [
          pair("Authorization", "Basic abc"),
          pair("authorization", `Bearer ${token}`),
          pair("x-token", token),
        ],
        requestCookies: [pair("theme", "dark"), pair("session", token)],
        responseCookies: [pair("refresh", token)],
        queryString: [pair("token", token)],
      }),
    ).toEqual([
      { source: "Authorization header", jwt: decoded },
      { source: "cookie session", jwt: decoded },
      { source: "set-cookie refresh", jwt: decoded },
      { source: "query token", jwt: decoded },
    ])
  })

  it("finds nothing in an exchange without JWTs", () => {
    expect(
      findTokens({
        requestHeaders: [],
        requestCookies: [],
        responseCookies: [],
        queryString: [],
      }),
    ).toEqual([])
  })
})

describe("decodeValue", () => {
  it("percent-decodes text", () => {
    expect(decodeValue("hello%20world")).toBe("hello world")
  })

  it("pretty-prints JSON objects and arrays, after percent-decoding", () => {
    expect(decodeValue("%7B%22a%22%3A1%7D")).toBe('{\n  "a": 1\n}')
    expect(decodeValue("[1,2]")).toBe("[\n  1,\n  2\n]")
  })

  it("shows a JWT's payload", () => {
    expect(decodeValue(jwt({ alg: "HS256" }, { sub: "42" }))).toBe(
      '{\n  "sub": "42"\n}',
    )
  })

  it("returns undefined when there is nothing to add", () => {
    for (const value of ["plain", "42", '"str"', "%E0%A4%A"])
      expect(decodeValue(value)).toBeUndefined()
  })
})
