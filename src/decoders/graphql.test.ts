import { describe, expect, it } from "vitest"
import { graphql } from "./graphql"
import type { RequestView } from "./types"

function post(body: unknown): RequestView {
  return {
    method: "POST",
    url: "https://api.test/graphql",
    status: 200,
    requestBody: { mimeType: "application/json", text: JSON.stringify(body) },
  }
}

function summary(body: unknown) {
  return graphql.decode(post(body))?.summary
}

describe("graphql", () => {
  it("summarizes named operations by type and name", () => {
    const body = { query: "query GetUser { user { id } }" }

    expect(graphql.decode(post(body))).toEqual({
      summary: "query GetUser",
      data: body,
    })
    expect(summary({ query: "mutation AddTodo { add { id } }" })).toBe(
      "mutation AddTodo",
    )
    expect(summary({ query: "subscription OnTick { tick }" })).toBe(
      "subscription OnTick",
    )
  })

  it("summarizes anonymous and shorthand operations", () => {
    expect(summary({ query: "query { user { id } }" })).toBe("query")
    expect(summary({ query: "query ($id: ID) { user(id: $id) { id } }" })).toBe(
      "query",
    )
    expect(summary({ query: "{ user { id } }" })).toBe("query")
    expect(summary({ query: "{ mutation { id } }" })).toBe("query")
  })

  it("ignores braces and keywords in strings and comments", () => {
    expect(
      summary({
        query:
          '# mutation Fake\n{ a(s: "} mutation B {") } mutation Real { b }',
      }),
    ).toBe("query")
  })

  it("picks the operation named by operationName, else the first", () => {
    const query = "fragment F on User { id } query A { ...F } mutation B { x }"

    expect(summary({ query, operationName: "B" })).toBe("mutation B")
    expect(summary({ query })).toBe("query A")
  })

  it("ignores JSON without a query", () => {
    expect(graphql.decode(post({ a: 1 }))).toBeUndefined()
  })
})
