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

function label(body: unknown) {
  const decoded = graphql.decode(post(body))
  return decoded && { title: decoded.title, detail: decoded.detail }
}

const op = (title: string, detail: string) => ({ title, detail })

describe("graphql", () => {
  it("summarizes named operations by type and name", () => {
    const body = { query: "query GetUser { user { id } }" }

    expect(graphql.decode(post(body))).toEqual({
      title: "GetUser",
      detail: "query",
      data: body,
    })
    expect(label({ query: "mutation AddTodo { add { id } }" })).toEqual(
      op("AddTodo", "mutation"),
    )
    expect(label({ query: "subscription OnTick { tick }" })).toEqual(
      op("OnTick", "subscription"),
    )
  })

  it("summarizes anonymous and shorthand operations", () => {
    const anonymous = op("anonymous", "query")
    expect(label({ query: "query { user { id } }" })).toEqual(anonymous)
    expect(
      label({ query: "query ($id: ID) { user(id: $id) { id } }" }),
    ).toEqual(anonymous)
    expect(label({ query: "{ user { id } }" })).toEqual(anonymous)
    expect(label({ query: "{ mutation { id } }" })).toEqual(anonymous)
  })

  it("ignores braces and keywords in strings and comments", () => {
    expect(
      label({
        query:
          '# mutation Fake\n{ a(s: "} mutation B {") } mutation Real { b }',
      }),
    ).toEqual(op("anonymous", "query"))
  })

  it("picks the operation named by operationName, else the first", () => {
    const query = "fragment F on User { id } query A { ...F } mutation B { x }"

    expect(label({ query, operationName: "B" })).toEqual(op("B", "mutation"))
    expect(label({ query })).toEqual(op("A", "query"))
  })

  it("decodes GET requests from query params", () => {
    const get = (params: Record<string, string>): RequestView => ({
      method: "GET",
      url: `https://api.test/graphql?${new URLSearchParams(params)}`,
      status: 200,
      mimeType: "",
    })
    const query = "query GetUser { a } query Other { b }"

    expect(graphql.decode(get({ query }))).toMatchObject(op("GetUser", "query"))
    expect(
      graphql.decode(get({ query, operationName: "Other" })),
    ).toMatchObject(op("Other", "query"))
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

    expect(graphql.decode(get(extensions))).toMatchObject(
      op("GetUser", "persisted"),
    )
    expect(graphql.decode(get("not-json"))).toBeUndefined()
  })

  it("summarizes persisted queries sent by hash", () => {
    const extensions = {
      persistedQuery: { version: 1, sha256Hash: "abcdef1234567890" },
    }
    const named = { operationName: "GetUser", extensions }

    expect(graphql.decode(post(named))).toEqual({
      title: "GetUser",
      detail: "persisted",
      data: named,
    })
    expect(label({ extensions })).toEqual(op("abcdef12", "persisted"))
    expect(label({ query: "query A { a }", extensions })).toEqual(
      op("A", "query"),
    )
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
      title: "A, B",
      detail: "2 ops",
      data: {
        operations: [
          { name: "query A", value: "query A { a }" },
          { name: "mutation B", value: "mutation B { b }" },
        ],
      },
    })
    expect(label([{ query: "query A { a }" }])).toEqual(op("A", "1 op"))
  })

  it("titles anonymous batch items as anonymous", () => {
    expect(
      graphql.decode(post([{ query: "{ a }" }, { query: "query B { b }" }])),
    ).toEqual({
      title: "anonymous, B",
      detail: "2 ops",
      data: {
        operations: [
          { name: "query anonymous", value: "{ a }" },
          { name: "query B", value: "query B { b }" },
        ],
      },
    })
  })

  it("summarizes APQ items in a batch by name, valued by hash", () => {
    const apq = {
      operationName: "X",
      extensions: { persistedQuery: { sha256Hash: "abc123ff00" } },
    }
    expect(graphql.decode(post([apq]))).toEqual({
      title: "X",
      detail: "1 op",
      data: { operations: [{ name: "persisted X", value: "abc123ff00" }] },
    })
  })

  it("ignores empty batches and batches with non-GraphQL items", () => {
    expect(label([])).toBeUndefined()
    expect(label([{ query: "query A { a }" }, { foo: 1 }])).toBeUndefined()
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
        title: "Upload",
        detail: "mutation",
        data: { query, variables: { file: null }, files },
      })
    })

    it("handles batched operations", () => {
      const batch = [
        { query: "mutation A { a }" },
        { query: "mutation B { b }" },
      ]
      expect(graphql.decode(upload(JSON.stringify(batch)))).toEqual({
        title: "A, B",
        detail: "2 ops",
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
    const decoded = {
      kind: "graphql",
      title: "Broken",
      detail: "query",
      data: {},
    }
    const response = (body: unknown) =>
      graphql.decodeResponse?.(
        {
          content: typeof body === "string" ? body : JSON.stringify(body),
          encoding: "",
        },
        decoded,
        [],
      )

    it("decodes base64 response bodies", () => {
      expect(
        graphql.decodeResponse?.(
          {
            content: btoa('{"errors":[{"message":"boom"}]}'),
            encoding: "base64",
          },
          decoded,
          [],
        )?.summary,
      ).toBe("1 error")
    })

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

    describe("incremental", () => {
      const multipart = (...parts: unknown[]) =>
        [
          "",
          ...parts.flatMap((p) => [
            "---",
            "Content-Type: application/json; charset=utf-8",
            "",
            JSON.stringify(p),
          ]),
          "-----",
          "",
        ].join("\r\n")
      const parts = [
        { data: { user: { id: "1", friends: [{ id: "a" }] } }, hasNext: true },
        {
          incremental: [
            { data: { name: "Ada" }, path: ["user"] },
            { items: [{ id: "b" }, { id: "c" }], path: ["user", "friends", 1] },
          ],
          hasNext: true,
        },
        {
          incremental: [
            {
              data: { bio: null },
              path: ["user"],
              errors: [{ message: "no bio", path: ["user", "bio"] }],
            },
          ],
          hasNext: false,
        },
      ]
      const merged = {
        summary: "1 error",
        data: {
          errors: [{ name: "user.bio", value: "no bio" }],
          data: {
            user: {
              id: "1",
              friends: [{ id: "a" }, { id: "b" }, { id: "c" }],
              name: "Ada",
              bio: null,
            },
          },
          parts: 3,
        },
      }

      it("merges @defer data at paths and @stream items, with errors", () => {
        expect(response(multipart(...parts))).toEqual(merged)
        expect(response(multipart(...parts).replace(/\r\n/g, "\n"))).toEqual(
          merged,
        )
      })

      it("collects top-level errors from parts", () => {
        const text = multipart(
          { data: { a: 1 }, hasNext: true },
          { errors: [{ message: "late" }], hasNext: false },
        )
        expect(response(text)?.data).toEqual({
          errors: [{ name: "(root)", value: "late" }],
          data: { a: 1 },
          parts: 2,
        })
      })

      it("ignores multipart text without JSON parts", () => {
        expect(response("---\r\n\r\nhello\r\n-----")).toBeUndefined()
      })
    })

    it("ignores non-GraphQL responses", () => {
      expect(response("nope")).toBeUndefined()
      expect(response({ foo: 1 })).toBeUndefined()
    })
  })
})
