import { describe, expect, it } from "vitest"
import { dataSections } from "./summary"

describe("dataSections", () => {
  it("shows strings as-is and other fields as pretty JSON", () => {
    expect(
      dataSections({ query: "q", operationName: "A", variables: { id: 1 } }),
    ).toEqual([
      { name: "query", text: "q" },
      { name: "operationName", text: "A" },
      { name: "variables", text: '{\n  "id": 1\n}' },
    ])
  })

  it("handles missing and non-object data", () => {
    expect(dataSections(null)).toEqual([])
    expect(dataSections(undefined)).toEqual([])
    expect(dataSections("x")).toEqual([{ name: "data", text: "x" }])
    expect(dataSections([1, 2])).toEqual([
      { name: "data", text: "[\n  1,\n  2\n]" },
    ])
  })
})
