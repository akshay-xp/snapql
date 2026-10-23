import { describe, expect, it } from "vitest"
import { emptyExchange } from "../capture/entry"
import { toCurl } from "./curl"

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
