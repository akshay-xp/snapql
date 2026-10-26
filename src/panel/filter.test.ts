import { describe, expect, it } from "vitest"
import { emptyExchange } from "../capture/test-helpers"
import {
  bodyHit,
  chipsFor,
  excerpt,
  highlight,
  isHidden,
  kindOf,
  matchesFilters,
  matchesQuery,
  noHide,
  prune,
  statusGroup,
  toggle,
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

  it("matches body text when given", () => {
    expect(matchesQuery(two, "needle", "a needle here")).toBe(true)
    expect(matchesQuery(two, "NEEDLE", "a needle here")).toBe(true)
    expect(matchesQuery(two, "needle")).toBe(false)
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

describe("matchesFilters", () => {
  const gql = (status: number) => ({ status, decoded: decoded("graphql") })
  const json = (status: number) => ({ status, decoded: decoded("json") })
  const none = { kinds: [], statuses: [] }

  it("matches everything with nothing selected", () => {
    expect(matchesFilters(gql(200), none)).toBe(true)
    expect(matchesFilters(two, none)).toBe(true)
  })

  it("ORs within a group", () => {
    const kinds = (k: string[]) => ({ ...none, kinds: k })
    expect(matchesFilters(gql(200), kinds(["graphql"]))).toBe(true)
    expect(matchesFilters(json(200), kinds(["graphql"]))).toBe(false)
    expect(matchesFilters(json(200), kinds(["graphql", "json"]))).toBe(true)
  })

  it("ANDs across groups", () => {
    const f = { kinds: ["graphql"], statuses: ["4xx"] }
    expect(matchesFilters(gql(404), f)).toBe(true)
    expect(matchesFilters(gql(200), f)).toBe(false)
    expect(matchesFilters(json(404), f)).toBe(false)
  })

  it("toggles a value without mutating", () => {
    const on = toggle(none, "kinds", "json")
    expect(on).toEqual({ kinds: ["json"], statuses: [] })
    expect(none.kinds).toEqual([])
    expect(toggle(on, "kinds", "json")).toEqual(none)
  })

  it("prunes values no longer present", () => {
    expect(
      prune(
        { kinds: ["graphql", "json"], statuses: ["4xx"] },
        { kinds: ["json"], statuses: ["2xx"] },
      ),
    ).toEqual({ kinds: ["json"], statuses: [] })
  })
})

describe("excerpt", () => {
  it("keeps short text whole", () => {
    expect(excerpt("one two three", "two")).toBe("one two three")
  })

  it("cuts around the first match, keeping its case", () => {
    const text = `${"x".repeat(30)}Needle${"y".repeat(100)}`
    expect(excerpt(text, "needle")).toBe(
      `…${"x".repeat(20)}Needle${"y".repeat(60)}…`,
    )
  })

  it("collapses whitespace", () => {
    expect(excerpt("a\n   b", "b")).toBe("a b")
  })

  it("is undefined without a match", () => {
    expect(excerpt("abc", "z")).toBeUndefined()
  })
})

describe("bodyHit", () => {
  it("prefers the response and counts its matches", () => {
    expect(
      bodyHit({ request: "apple", response: "Apple pie, apple" }, "apple"),
    ).toEqual({ side: "response", count: 2, excerpt: "Apple pie, apple" })
  })

  it("falls back to the request", () => {
    expect(bodyHit({ request: "plum", response: "ok" }, "plum")).toEqual({
      side: "request",
      count: 1,
      excerpt: "plum",
    })
  })

  it("is undefined without a match", () => {
    expect(bodyHit({ request: "", response: "ok" }, "x")).toBeUndefined()
  })
})

describe("isHidden", () => {
  const entry = (over: {
    method?: string
    status?: number
    mimeType?: string
    fromCache?: "memory" | "disk"
  }) => ({
    method: over.method ?? "GET",
    status: over.status ?? 200,
    mimeType: over.mimeType ?? "",
    exchange: { ...emptyExchange, fromCache: over.fromCache },
  })

  it("hides nothing with every toggle off", () => {
    expect(isHidden(entry({ method: "OPTIONS", status: 304 }), noHide)).toBe(
      false,
    )
  })

  it("hides preflights", () => {
    const hide = { ...noHide, preflights: true }
    expect(isHidden(entry({ method: "OPTIONS" }), hide)).toBe(true)
    expect(isHidden(entry({}), hide)).toBe(false)
  })

  it("hides responses served from cache or not modified", () => {
    const hide = { ...noHide, cached: true }
    expect(isHidden(entry({ fromCache: "memory" }), hide)).toBe(true)
    expect(isHidden(entry({ fromCache: "disk" }), hide)).toBe(true)
    expect(isHidden(entry({ status: 304 }), hide)).toBe(true)
    expect(isHidden(entry({}), hide)).toBe(false)
  })
})
