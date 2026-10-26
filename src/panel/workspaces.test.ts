import { describe, expect, it, vi } from "vitest"
import { defaultHide } from "./filter"
import {
  createWorkspaces,
  defaultWorkspaces,
  parseWorkspaces,
  type Stored,
} from "./workspaces"

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

describe("createWorkspaces", () => {
  const adapter = (text?: string) => ({
    load: async () => text,
    save: vi.fn<(text: string) => void>(),
  })
  const savedActive = (save: ReturnType<typeof adapter>["save"]) => {
    const stored: Stored = JSON.parse(save.mock.lastCall?.[0] ?? "")
    return stored.workspaces.find((w) => w.id === stored.active)
  }

  it("applies the loaded workspace", async () => {
    const store = createWorkspaces(adapter(JSON.stringify(gql)))
    await store.ready
    expect(store.filters()).toEqual({ kinds: ["graphql"], statuses: [] })
    expect(store.hide()).toEqual({ ...defaultHide, assets: false })
  })

  it("saves every change into the active workspace", async () => {
    const storage = adapter()
    const store = createWorkspaces(storage)
    await store.ready
    store.setHide({ ...defaultHide, assets: false })
    expect(store.hide().assets).toBe(false)
    expect(storage.save).toHaveBeenCalledTimes(1)
    expect(savedActive(storage.save)?.hide.assets).toBe(false)

    store.setFilters({ kinds: ["json"], statuses: [] })
    expect(storage.save).toHaveBeenCalledTimes(2)
    expect(savedActive(storage.save)?.filters.kinds).toEqual(["json"])
  })

  it("keeps working when saving fails", async () => {
    const store = createWorkspaces({
      load: async () => undefined,
      save: () => {
        throw new Error("quota")
      },
    })
    await store.ready
    store.setFilters({ kinds: ["json"], statuses: [] })
    expect(store.filters().kinds).toEqual(["json"])
  })
})
