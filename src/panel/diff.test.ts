import { describe, expect, it } from "vitest"
import { emptyExchange } from "../capture/entry"
import { collapse, diffLines, diffSections } from "./diff"

const ops = (a: string, b: string) => diffLines(a, b).map((l) => l.op + l.text)

describe("diffLines", () => {
  it("keeps identical lines equal", () => {
    expect(ops("a\nb", "a\nb")).toEqual([" a", " b"])
  })

  it("marks inserts, deletes and replacements", () => {
    expect(ops("a\nc", "a\nb\nc")).toEqual([" a", "+b", " c"])
    expect(ops("a\nb\nc", "a\nc")).toEqual([" a", "-b", " c"])
    expect(ops("a\nb\nc", "a\nx\nc")).toEqual([" a", "-b", "+x", " c"])
  })

  it("handles empty sides", () => {
    expect(ops("", "a")).toEqual(["+a"])
    expect(ops("a", "")).toEqual(["-a"])
    expect(ops("", "")).toEqual([])
  })

  it("finds a minimal edit script", () => {
    const lines = diffLines("a\nb\nc\na\nb\nb\na", "c\nb\na\nb\na\nc")
    expect(lines.filter((l) => l.op !== " ")).toHaveLength(5)
    expect(
      lines
        .filter((l) => l.op !== "+")
        .map((l) => l.text)
        .join(""),
    ).toBe("abcabba")
    expect(
      lines
        .filter((l) => l.op !== "-")
        .map((l) => l.text)
        .join(""),
    ).toBe("cbabac")
  })
})

const entry = (
  url: string,
  status: number,
  statusText: string,
  headers: [string, string][],
  body: string,
) => ({
  method: "POST",
  url,
  status,
  requestBody: { mimeType: "application/json", text: body },
  exchange: {
    ...emptyExchange,
    statusText,
    requestHeaders: headers.map(([name, value]) => ({ name, value })),
    queryString: [
      { name: "v", value: new URL(url).searchParams.get("v") ?? "" },
    ],
  },
})

describe("diffSections", () => {
  const base = entry(
    "https://x.test/a?v=1",
    200,
    "OK",
    [
      ["x-v", "1"],
      ["accept", "*"],
    ],
    '{"a":1,"b":2}',
  )
  const other = entry(
    "https://x.test/b?v=2",
    400,
    "Bad Request",
    [
      ["accept", "*"],
      ["x-v", "2"],
    ],
    '{"b":2,"a":3}',
  )
  const sections = diffSections(
    base,
    other,
    '{"id":1,"n":"x"}',
    '{"n":"x","id":1}',
  )
  const section = (name: string) => sections.find((s) => s.name === name)

  it("compares each part of the exchange in order", () => {
    expect(sections.map((s) => s.name)).toEqual([
      "Request line",
      "Status",
      "Request headers",
      "Query",
      "Request body",
      "Response headers",
      "Response body",
    ])
    expect(section("Request headers")).toEqual({
      name: "Request headers",
      changed: true,
      lines: [
        { op: " ", text: "accept: *" },
        { op: "-", text: "x-v: 1" },
        { op: "+", text: "x-v: 2" },
      ],
    })
    const body = section("Request body")?.lines.map((l) => l.op + l.text)
    expect(body).toContain('-  "a": 1,')
    expect(body).toContain('+  "a": 3,')
  })

  it("ignores JSON key order and marks unchanged sections", () => {
    expect(section("Response body")?.changed).toBe(false)
    expect(section("Response headers")?.changed).toBe(false)
    expect(diffSections(base, base, "x", "x").every((s) => !s.changed)).toBe(
      true,
    )
  })
})

describe("collapse", () => {
  it("keeps context around changes and counts the rest", () => {
    const same = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ op: " " as const, text: `${i}` }))
    const out = collapse([...same(20), { op: "-", text: "x" }, ...same(20)])
    expect(out.map((l) => l.op + l.text)).toEqual([
      " 0",
      " 1",
      " 2",
      " … 14 unchanged lines",
      " 17",
      " 18",
      " 19",
      "-x",
      " 0",
      " 1",
      " 2",
      " … 14 unchanged lines",
      " 17",
      " 18",
      " 19",
    ])
  })
})
