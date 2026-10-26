import { createSignal } from "solid-js"
import { defaultHide, type Filters, type Hide, noFilters } from "./filter"

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
      filters: noFilters,
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

function nextName(names: string[]) {
  let n = 2
  while (names.includes(`Workspace ${n}`)) n++
  return `Workspace ${n}`
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
  const commit = (next: Stored) => {
    setStored(next)
    try {
      storage.save(JSON.stringify(next))
    } catch {}
  }
  const update = (change: Partial<Workspace>) =>
    commit({
      ...stored(),
      workspaces: stored().workspaces.map((w) =>
        w.id === stored().active ? { ...w, ...change } : w,
      ),
    })
  return {
    ready,
    list: () => stored().workspaces.map(({ id, name }) => ({ id, name })),
    activeId: () => stored().active,
    select: (id: string) => {
      if (stored().workspaces.some((w) => w.id === id))
        commit({ ...stored(), active: id })
    },
    // A copy of the active workspace, so the user starts from what they see.
    create: () => {
      const id = crypto.randomUUID()
      const { workspaces } = stored()
      const name = nextName(workspaces.map((w) => w.name))
      commit({
        active: id,
        workspaces: [...workspaces, { ...active(), id, name }],
      })
      return id
    },
    name: () => active().name,
    filters: () => active().filters,
    hide: () => active().hide,
    setFilters: (filters: Filters) => update({ filters }),
    setHide: (hide: Hide) => update({ hide }),
  }
}

const KEY = "snapql.workspaces"

// Sync storage behind the async adapter, so chrome.storage can replace it.
export function localWorkspaces(
  kv: Pick<Storage, "getItem" | "setItem"> | undefined,
): WorkspaceStorage {
  return {
    load: async () => {
      try {
        return kv?.getItem(KEY) ?? undefined
      } catch {}
    },
    save: (text) => {
      try {
        kv?.setItem(KEY, text)
      } catch {}
    },
  }
}
