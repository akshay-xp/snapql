import { describe, expect, it } from "vitest"
import { defaultHide } from "./filter"
import { defaultWorkspaces, parseWorkspaces, type Stored } from "./workspaces"

const gql: Stored = {
  active: "gql",
  workspaces: [
    {
      id: "gql",
      name: "GraphQL",
      filters: { kinds: ["graphql"], statuses: [] },
      hide: { ...defaultHide, assets: false },
    },
  ],
}

describe("parseWorkspaces", () => {
  it("falls back to Default when missing or broken", () => {
    expect(defaultWorkspaces).toEqual({
      active: "default",
      workspaces: [
        {
          id: "default",
          name: "Default",
          filters: { kinds: [], statuses: [] },
          hide: defaultHide,
        },
      ],
    })
    for (const text of [undefined, "{", '{"active":1}'])
      expect(parseWorkspaces(text), String(text)).toEqual(defaultWorkspaces)
  })

  it("keeps a valid set", () => {
    expect(parseWorkspaces(JSON.stringify(gql))).toEqual(gql)
  })

  it("points a dangling active id at the first workspace", () => {
    expect(
      parseWorkspaces(JSON.stringify({ ...gql, active: "gone" })).active,
    ).toBe("gql")
  })
})
