import { describe, expect, it } from "vitest"
import {
  chipsFor,
  highlight,
  kindOf,
  matchesQuery,
  statusGroup,
} from "./filter"

const graphql = {
  method: "POST",
  url: "https://x.test/graphql",
  status: 200,
  decoded: { kind: "graphql", title: "GetUser", detail: "query", data: {} },
}
const two = { method: "POST", url: "https://x.test/api/two", status: 201 }

describe("matchesQuery", () => {
  it("matches title, detail, kind and URL, ignoring case", () => {
    for (const q of ["getuser", "QUERY", "graph", "x.test", ""])
      expect(matchesQuery(graphql, q), q).toBe(true)
    expect(matchesQuery(graphql, "mutation")).toBe(false)
  })

  it("matches undecoded rows by path and method", () => {
    expect(matchesQuery(two, "post")).toBe(true)
    expect(matchesQuery(two, "/api/t")).toBe(true)
  })
})

describe("highlight", () => {
  it("marks every occurrence in original casing", () => {
    expect(highlight("GetUser getuser", "user")).toEqual([
      { text: "Get", hit: false },
      { text: "User", hit: true },
      { text: " get", hit: false },
      { text: "user", hit: true },
    ])
  })

  it("returns plain text for empty or missing queries", () => {
    expect(highlight("abc", "")).toEqual([{ text: "abc", hit: false }])
    expect(highlight("abc", "z")).toEqual([{ text: "abc", hit: false }])
  })

  it("matches regex characters literally", () => {
    expect(highlight("abc a.c", "a.c")).toEqual([
      { text: "abc ", hit: false },
      { text: "a.c", hit: true },
    ])
  })
})

const decoded = (kind: string) => ({ kind, title: "t", data: undefined })

describe("filter chips", () => {
  it("names kinds, with other for undecoded entries", () => {
    expect(kindOf(graphql)).toBe("graphql")
    expect(kindOf(two)).toBe("other")
  })

  it("groups statuses by hundreds, failed for 0", () => {
    expect([0, 101, 200, 304, 404, 503].map(statusGroup)).toEqual([
      "failed",
      "1xx",
      "2xx",
      "3xx",
      "4xx",
      "5xx",
    ])
  })

  it("lists present chips in order, sentinels last", () => {
    expect(
      chipsFor([
        { status: 404 },
        { status: 200, decoded: decoded("graphql") },
        { status: 0, decoded: decoded("json") },
        { status: 500, decoded: decoded("graphql") },
      ]),
    ).toEqual({
      kinds: ["graphql", "json", "other"],
      statuses: ["2xx", "4xx", "5xx", "failed"],
    })
    expect(chipsFor([])).toEqual({ kinds: [], statuses: [] })
  })
})
