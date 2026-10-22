import { describe, expect, it } from "vitest"
import { graphql } from "./graphql"
import type { RequestView } from "./types"

function post(body: unknown): RequestView {
  return {
    method: "POST",
    url: "https://api.test/graphql",
    status: 200,
    mimeType: "",
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

  it("decodes GET requests from query params", () => {
    const get = (params: Record<string, string>): RequestView => ({
      method: "GET",
      url: `https://api.test/graphql?${new URLSearchParams(params)}`,
      status: 200,
      mimeType: "",
    })
    const query = "query GetUser { a } query Other { b }"

    expect(graphql.decode(get({ query }))).toMatchObject({
      summary: "query GetUser",
    })
    expect(
      graphql.decode(get({ query, operationName: "Other" }))?.summary,
    ).toBe("query Other")
  })

  it("decodes persisted queries sent as GET params", () => {
    const get = (extensions: string): RequestView => ({
      method: "GET",
      url: `https://api.test/graphql?${new URLSearchParams({ operationName: "GetUser", extensions })}`,
      status: 200,
      mimeType: "",
    })
    const extensions = JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: "abcdef1234567890" },
    })

    expect(graphql.decode(get(extensions))?.summary).toBe("persisted GetUser")
    expect(graphql.decode(get("not-json"))).toBeUndefined()
  })

  it("summarizes persisted queries sent by hash", () => {
    const extensions = {
      persistedQuery: { version: 1, sha256Hash: "abcdef1234567890" },
    }
    const named = { operationName: "GetUser", extensions }

    expect(graphql.decode(post(named))).toEqual({
      summary: "persisted GetUser",
      data: named,
    })
    expect(summary({ extensions })).toBe("persisted abcdef12")
    expect(summary({ query: "query A { a }", extensions })).toBe("query A")
    expect(graphql.decode(post({ extensions: {} }))).toBeUndefined()
  })

  it("ignores JSON without a query", () => {
    expect(graphql.decode(post({ a: 1 }))).toBeUndefined()
  })

  it("ignores non-JSON and batched bodies", () => {
    const form: RequestView = {
      ...post({}),
      requestBody: {
        mimeType: "application/x-www-form-urlencoded",
        text: "a=1&b=2",
      },
    }

    expect(graphql.decode(form)).toBeUndefined()
  })

  it("summarizes batches per operation", () => {
    expect(
      graphql.decode(
        post([{ query: "query A { a }" }, { query: "mutation B { b }" }]),
      ),
    ).toEqual({
      summary: "2 operations: query A, mutation B",
      data: {
        operations: [
          { name: "query A", value: "query A { a }" },
          { name: "mutation B", value: "mutation B { b }" },
        ],
      },
    })
    expect(summary([{ query: "query A { a }" }])).toBe("1 operation: query A")
  })

  it("summarizes APQ items in a batch by name, valued by hash", () => {
    const apq = {
      operationName: "X",
      extensions: { persistedQuery: { sha256Hash: "abc123ff00" } },
    }
    expect(graphql.decode(post([apq]))).toEqual({
      summary: "1 operation: persisted X",
      data: { operations: [{ name: "persisted X", value: "abc123ff00" }] },
    })
  })

  it("ignores empty batches and batches with non-GraphQL items", () => {
    expect(summary([])).toBeUndefined()
    expect(summary([{ query: "query A { a }" }, { foo: 1 }])).toBeUndefined()
  })

  it("lists variables of batched operations that have them", () => {
    const decoded = graphql.decode(
      post([
        { query: "query A($id: ID) { a(id: $id) }", variables: { id: 1 } },
        { query: "query B { b }" },
      ]),
    )
    expect(decoded?.data).toHaveProperty("variables", [
      { name: "query A", value: '{"id":1}' },
    ])
    expect(
      graphql.decode(post([{ query: "query B { b }" }]))?.data,
    ).not.toHaveProperty("variables")
  })

  describe("uploads", () => {
    const query = "mutation Upload($file: Upload!) { upload(file: $file) }"
    const upload = (operations: string, withOperations = true): RequestView => {
      const field = (name: string, value: string) =>
        `--X\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      const text = [
        withOperations ? field("operations", operations) : "",
        field("map", '{"0":["variables.file"]}'),
        '--X\r\nContent-Disposition: form-data; name="0"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nhi\r\n',
        "--X--",
      ].join("")
      return {
        method: "POST",
        url: "https://api.test/graphql",
        status: 200,
        mimeType: "",
        requestBody: { mimeType: "multipart/form-data; boundary=X", text },
      }
    }
    const files = [{ name: "0", value: "a.txt (text/plain, 2 bytes)" }]

    it("summarizes the operations field and lists files", () => {
      expect(
        graphql.decode(
          upload(JSON.stringify({ query, variables: { file: null } })),
        ),
      ).toEqual({
        summary: "mutation Upload",
        data: { query, variables: { file: null }, files },
      })
    })

    it("handles batched operations", () => {
      const batch = [
        { query: "mutation A { a }" },
        { query: "mutation B { b }" },
      ]
      expect(graphql.decode(upload(JSON.stringify(batch)))).toEqual({
        summary: "2 operations: mutation A, mutation B",
        data: {
          operations: [
            { name: "mutation A", value: "mutation A { a }" },
            { name: "mutation B", value: "mutation B { b }" },
          ],
          files,
        },
      })
    })

    it("ignores multipart bodies without GraphQL operations", () => {
      expect(graphql.decode(upload("", false))).toBeUndefined()
      expect(graphql.decode(upload('{"foo":1}'))).toBeUndefined()
    })
  })

  describe("decodeResponse", () => {
    const decoded = { kind: "graphql", summary: "query Broken", data: {} }
    const response = (body: unknown) =>
      graphql.decodeResponse?.(
        typeof body === "string" ? body : JSON.stringify(body),
        decoded,
      )

    it("lists errors by path, plus data", () => {
      expect(
        response({
          data: { user: null },
          errors: [
            { message: "boom", path: ["user", "posts", 0] },
            { message: "bad" },
          ],
        }),
      ).toEqual({
        summary: "2 errors",
        data: {
          errors: [
            { name: "user.posts.0", value: "boom" },
            { name: "(root)", value: "bad" },
          ],
          data: { user: null },
        },
      })
      expect(response({ errors: [{ message: "x" }] })?.summary).toBe("1 error")
    })

    it("shows data alone when there are no errors", () => {
      expect(response({ data: { a: 1 } })).toEqual({
        summary: "no errors",
        data: { data: { a: 1 } },
      })
    })

    it("ignores non-GraphQL responses", () => {
      expect(response("nope")).toBeUndefined()
      expect(response({ foo: 1 })).toBeUndefined()
    })
  })
})
