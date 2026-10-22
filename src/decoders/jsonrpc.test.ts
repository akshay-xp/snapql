import { describe, expect, it } from "vitest"
import { jsonrpc } from "./jsonrpc"
import type { RequestView } from "./types"

function post(text?: string): RequestView {
  return {
    method: "POST",
    url: "https://x/rpc",
    status: 200,
    mimeType: "application/json",
    requestBody:
      text === undefined ? undefined : { mimeType: "application/json", text },
  }
}

const call = (method: unknown, params?: unknown) => ({
  jsonrpc: "2.0",
  method,
  params,
  id: 1,
})
const body = (v: unknown) => post(JSON.stringify(v))

describe("jsonrpc", () => {
  it("summarizes a call by its method", () => {
    expect(jsonrpc.decode(body(call("sum", [1, 2])))).toEqual({
      summary: "sum",
      data: { method: "sum", params: [1, 2] },
    })
  })

  it("lists batch calls as rows", () => {
    const batch = [call("sum", [1, 2]), call("ping"), call("get", { id: 7 })]
    expect(jsonrpc.decode(body(batch))).toEqual({
      summary: "3 calls",
      data: {
        calls: [
          { name: "sum", value: "[1,2]" },
          { name: "ping", value: "" },
          { name: "get", value: '{"id":7}' },
        ],
      },
    })
  })

  it("ignores anything that is not JSON-RPC 2.0", () => {
    for (const req of [
      body({ jsonrpc: "1.0", method: "sum" }),
      body(call(1)),
      body([call("sum"), { method: "x" }]),
      body([]),
      post("sum"),
      post(),
    ])
      expect(jsonrpc.decode(req)).toBeUndefined()
  })
})
