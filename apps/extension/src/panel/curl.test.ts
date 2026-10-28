import { describe, expect, it } from "vitest"
import { emptyExchange } from "../capture/entry"
import { toCurl, toFetch } from "./curl"

const request = (
  method: string,
  headers: [string, string][],
  text?: string,
) => ({
  method,
  url: "https://x.test/api?a=1",
  ...(text !== undefined && {
    requestBody: { mimeType: "application/json", text },
  }),
  exchange: {
    ...emptyExchange,
    requestHeaders: headers.map(([name, value]) => ({ name, value })),
  },
})

const post = request(
  "POST",
  [
    [":authority", "x.test"],
    ["content-type", "application/json"],
    ["Content-Length", "11"],
    ["accept-encoding", "gzip"],
    ["x-note", "it's"],
  ],
  `{"a":"b's"}`,
)

describe("toCurl", () => {
  it("quotes the URL, kept headers and body", () => {
    expect(toCurl(post)).toBe(
      [
        "curl 'https://x.test/api?a=1'",
        "  -H 'content-type: application/json'",
        "  -H 'x-note: it'\\''s'",
        `  --data-raw '{"a":"b'\\''s"}'`,
      ].join(" \\\n"),
    )
  })

  it("omits -X when the method is implied", () => {
    expect(toCurl(request("GET", [["accept", "*/*"]]))).toBe(
      "curl 'https://x.test/api?a=1' \\\n  -H 'accept: */*'",
    )
  })

  it("adds -X otherwise", () => {
    expect(toCurl(request("PUT", [], "x"))).toBe(
      "curl 'https://x.test/api?a=1' \\\n  -X 'PUT' \\\n  --data-raw 'x'",
    )
    expect(toCurl(request("POST", []))).toBe(
      "curl 'https://x.test/api?a=1' \\\n  -X 'POST'",
    )
  })
})

describe("toFetch", () => {
  const options = (code: string) => {
    const prefix = 'await fetch("https://x.test/api?a=1", '
    expect(code.startsWith(prefix)).toBe(true)
    expect(code.endsWith(")")).toBe(true)
    return JSON.parse(code.slice(prefix.length, -1))
  }

  it("writes method, kept headers and body as JSON", () => {
    expect(options(toFetch(post))).toEqual({
      method: "POST",
      headers: { "content-type": "application/json", "x-note": "it's" },
      body: `{"a":"b's"}`,
    })
  })

  it("omits the body when there is none; later headers win", () => {
    const get = request("GET", [
      ["x-a", "1"],
      ["x-a", "2"],
    ])
    expect(options(toFetch(get))).toEqual({
      method: "GET",
      headers: { "x-a": "2" },
    })
  })
})
