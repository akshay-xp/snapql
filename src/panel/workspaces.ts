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
