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
      parts: ["/api/", "item", "?i=9"],
      detail: "GET",
    })
  })

  it("splits the title before the last path segment, keeping a trailing slash with it", () => {
    const parts = (path: string) =>
      rowLabel(entry({ url: `https://x.test${path}` })).parts
    expect(parts("/a/b/c")).toEqual(["/a/b/", "c", ""])
    expect(parts("/api/users/")).toEqual(["/api/", "users/", ""])
    expect(parts("/?q=1")).toEqual(["", "/", "?q=1"])
  })

  it("labels failures by status, or failed when there is none", () => {
    expect(rowLabel(entry({ status: 404 })).failure).toBe("404")
    expect(rowLabel(entry({ status: 500 })).failure).toBe("500")
    expect(rowLabel(entry({ status: 399 }))).not.toHaveProperty("failure")
    expect(rowLabel(entry({ status: 0 })).failure).toBe("failed")
  })

  it("counts messages when the entry has them", () => {
    const msg = { dir: "in" as const, time: 0, text: "" }
    expect(rowLabel(entry({ messages: [msg, msg, msg] })).count).toBe("3 msgs")
    expect(rowLabel(entry({ messages: [msg] })).count).toBe("1 msg")
    expect(rowLabel(entry())).not.toHaveProperty("count")
  })

  it("marks open streams live", () => {
    expect(rowLabel(entry({ open: true })).live).toBe(true)
    expect(rowLabel(entry({ open: false }))).not.toHaveProperty("live")
    expect(rowLabel(entry())).not.toHaveProperty("live")
  })

  it("says how a socket closed", () => {
    const closed = rowLabel(
      entry({ socket: { protocol: "", closeCode: 1000 }, open: false }),
    )
    expect(closed.closed).toBe("closed 1000")
    const open = rowLabel(entry({ socket: { protocol: "" }, open: true }))
    expect(open.live).toBe(true)
    expect(open).not.toHaveProperty("closed")
    expect(rowLabel(entry())).not.toHaveProperty("closed")
  })
})
