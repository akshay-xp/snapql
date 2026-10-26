import { createSignal } from "solid-js"
import { defaultHide, type Filters, type Hide } from "./filter"

export type Workspace = {
  id: string
  name: string
  filters: Filters
  hide: Hide
}

export type Stored = { active: string; workspaces: Workspace[] }

export const defaultWorkspaces: Stored = {
  active: "default",
  workspaces: [
    {
      id: "default",
      name: "Default",
      filters: { kinds: [], statuses: [] },
      hide: defaultHide,
    },
  ],
}

export function parseWorkspaces(text: string | undefined): Stored {
  let stored: { active?: unknown; workspaces?: unknown }
  try {
    stored = JSON.parse(text ?? "")
  } catch {
    return defaultWorkspaces
  }
  const workspaces = stored?.workspaces
  if (!Array.isArray(workspaces) || !workspaces.length) return defaultWorkspaces
  const active = workspaces.some((w) => w.id === stored.active)
    ? (stored.active as string)
    : workspaces[0].id
  return { active, workspaces }
}

export type WorkspaceStorage = {
  load(): Promise<string | undefined>
  save(text: string): void
}

export type Workspaces = ReturnType<typeof createWorkspaces>

// Every edit saves into the active workspace: there is no Save step.
export function createWorkspaces(storage: WorkspaceStorage) {
  const [stored, setStored] = createSignal(defaultWorkspaces)
  const ready = storage.load().then((text) => {
    setStored(parseWorkspaces(text))
  })
  const active = () =>
    stored().workspaces.find((w) => w.id === stored().active) as Workspace
  const update = (change: Partial<Workspace>) => {
    const next = {
      ...stored(),
      workspaces: stored().workspaces.map((w) =>
        w.id === stored().active ? { ...w, ...change } : w,
      ),
    }
    setStored(next)
    try {
      storage.save(JSON.stringify(next))
    } catch {}
  }
  return {
    ready,
    filters: () => active().filters,
    hide: () => active().hide,
    setFilters: (filters: Filters) => update({ filters }),
    setHide: (hide: Hide) => update({ hide }),
  }
}
