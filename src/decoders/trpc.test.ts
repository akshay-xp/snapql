import { describe, expect, it } from "vitest"
import { trpc } from "./trpc"
import type { RequestView } from "./types"

function req(url: string, body?: string): RequestView {
  return {
    method: body === undefined ? "GET" : "POST",
    url,
    status: 200,
    mimeType: "application/json",
    requestBody:
      body === undefined
        ? undefined
        : { mimeType: "application/json", text: body },
  }
}

const input = (v: unknown) => encodeURIComponent(JSON.stringify(v))

describe("trpc", () => {
  it("summarizes a GET call by its procedure and input", () => {
    expect(
      trpc.decode(
        req(`https://x/api/trpc/user.byId?input=${input({ id: 1 })}`),
      ),
    ).toEqual({
      summary: "user.byId",
      data: { procedures: [{ name: "user.byId", value: '{"id":1}' }] },
    })
  })

  it("splits batches and keys inputs by position", () => {
    const batch = input({ "0": { x: 1 }, "1": { y: 2 } })
    const procedures = [
      { name: "a.b", value: '{"x":1}' },
      { name: "c.d", value: '{"y":2}' },
    ]
    expect(
      trpc.decode(req(`https://x/trpc/a.b,c.d?batch=1&input=${batch}`)),
    ).toEqual({ summary: "a.b, c.d", data: { procedures } })
    expect(
      trpc.decode(req(`https://x/trpc/a.b%2Cc.d?batch=1&input=${batch}`))?.data,
    ).toEqual({ procedures })
    expect(
      trpc.decode(
        req(`https://x/trpc/a.b,c.d?batch=1&input=${input({ "0": 1 })}`),
      )?.data,
    ).toEqual({
      procedures: [
        { name: "a.b", value: "1" },
        { name: "c.d", value: "" },
      ],
    })
  })

  it("reads POST input from the body", () => {
    expect(
      trpc.decode(req("https://x/trpc/post.create", '{"title":"t"}'))?.data,
    ).toEqual({ procedures: [{ name: "post.create", value: '{"title":"t"}' }] })
  })

  it("leaves a missing input empty", () => {
    expect(trpc.decode(req("https://x/trpc/post.list"))?.data).toEqual({
      procedures: [{ name: "post.list", value: "" }],
    })
  })

  it("ignores paths without a trpc procedure", () => {
    expect(trpc.decode(req("https://x/api/users/1"))).toBeUndefined()
    expect(trpc.decode(req("https://x/trpc"))).toBeUndefined()
  })
})
