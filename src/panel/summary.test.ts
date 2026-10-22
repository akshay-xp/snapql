import { describe, expect, it } from "vitest"
import { dataSections } from "./summary"

describe("dataSections", () => {
  it("keeps strings as text and other fields as JSON values", () => {
    expect(
      dataSections({ query: "q", operationName: "A", variables: { id: 1 } }),
    ).toEqual([
      { name: "query", text: "q" },
      { name: "operationName", text: "A" },
      { name: "variables", json: { id: 1 } },
    ])
  })

  it("handles missing and non-object data", () => {
    expect(dataSections(null)).toEqual([])
    expect(dataSections(undefined)).toEqual([])
    expect(dataSections("x")).toEqual([{ name: "data", text: "x" }])
    expect(dataSections([1, 2])).toEqual([{ name: "data", json: [1, 2] }])
    expect(dataSections({ parts: 3 })).toEqual([{ name: "parts", json: 3 }])
  })

  it("turns name/value lists into rows", () => {
    expect(dataSections({ fields: [{ name: "a", value: "1" }] })).toEqual([
      { name: "fields", rows: [{ name: "a", value: "1" }] },
    ])
    expect(dataSections({ list: [] })).toEqual([{ name: "list", json: [] }])
    expect(dataSections({ mixed: [{ name: "a", value: 1 }] })).toEqual([
      { name: "mixed", json: [{ name: "a", value: 1 }] },
    ])
  })
})
