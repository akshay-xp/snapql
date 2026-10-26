import { createEffect, createSignal, onCleanup } from "solid-js"

// Open state for a menu popover: Escape inside closes it and refocuses its
// button; a pointerdown outside root closes it.
export function createPopover(
  root: () => HTMLElement,
  button: () => HTMLElement,
) {
  const [open, setOpen] = createSignal(false)
  createEffect(() => {
    if (!open()) return
    const outside = (e: PointerEvent) => {
      if (!root().contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("pointerdown", outside)
    onCleanup(() => window.removeEventListener("pointerdown", outside))
  })
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return
    setOpen(false)
    button().focus()
  }
  return { open, setOpen, onKeyDown }
}
