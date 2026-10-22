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

  it("ignores JSON without a query", () => {
    expect(graphql.decode(post({ a: 1 }))).toBeUndefined()
  })
})
