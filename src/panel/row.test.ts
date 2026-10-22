import { describe, expect, it } from "vitest"
import { rowLabel } from "./row"

const entry = (overrides: Partial<Parameters<typeof rowLabel>[0]> = {}) => ({
  method: "GET",
  url: "https://x.test/api/item?i=9",
  status: 200,
  ...overrides,
})

describe("rowLabel", () => {
  it("uses the decoder's title, detail and kind", () => {
    expect(
      rowLabel(
        entry({
          decoded: {
            kind: "graphql",
            title: "GetUser",
            detail: "query",
            data: {},
          },
        }),
      ),
    ).toEqual({ title: "GetUser", detail: "query", kind: "graphql" })
    expect(
      rowLabel(
        entry({ decoded: { kind: "soap", title: "GetPrice", data: {} } }),
      ),
    ).toEqual({ title: "GetPrice", kind: "soap" })
  })

  it("titles undecoded requests by path and query, with the method as detail", () => {
    expect(rowLabel(entry())).toEqual({
      title: "/api/item?i=9",
      detail: "GET",
    })
  })

  it("labels failures by status, or failed when there is none", () => {
    expect(rowLabel(entry({ status: 404 })).failure).toBe("404")
    expect(rowLabel(entry({ status: 500 })).failure).toBe("500")
    expect(rowLabel(entry({ status: 399 }))).not.toHaveProperty("failure")
    expect(rowLabel(entry({ status: 0 })).failure).toBe("failed")
  })
})
