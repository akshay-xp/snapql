import { createSignal } from "solid-js"

const KEY = "snapql.showHeartbeats"

// Panel-wide, not per workspace: keep-alive noise is the same everywhere.
export function createShowHeartbeats(
  storage: Pick<Storage, "getItem" | "setItem"> | undefined,
) {
  let stored: string | null | undefined
  try {
    stored = storage?.getItem(KEY)
  } catch {}
  const [show, setSignal] = createSignal(stored === "true")
  const setShow = (next: boolean) => {
    setSignal(next)
    try {
      storage?.setItem(KEY, String(next))
    } catch {}
  }
  return [show, setShow] as const
}
