import { For, Show } from "solid-js"
import { createPopover } from "./popover"
import type { Workspaces } from "./workspaces"

const ITEM = "rounded px-2 py-1 text-left hover:bg-selected"

export function WorkspaceMenu(props: {
  workspaces: Workspaces
  onPick: (id: string) => void
}) {
  let root!: HTMLDivElement
  let button!: HTMLButtonElement
  const { open, setOpen, onKeyDown } = createPopover(
    () => root,
    () => button,
  )
  return (
    <div ref={root} data-workspace class="relative shrink-0 pl-2">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open()}
        title={props.workspaces.name()}
        class="block max-w-32 truncate rounded-full bg-surface px-2 py-0.5"
        onClick={() => setOpen(!open())}
      >
        {props.workspaces.name()}
      </button>
      <Show when={open()}>
        <div
          data-workspace-menu
          role="menu"
          onKeyDown={onKeyDown}
          class="absolute top-full left-2 z-10 mt-1 flex w-48 flex-col rounded-md border border-border bg-bg p-1 shadow-lg"
        >
          <For each={props.workspaces.list()}>
            {(w) => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={w.id === props.workspaces.activeId()}
                class={`${ITEM} truncate`}
                classList={{
                  "font-semibold": w.id === props.workspaces.activeId(),
                }}
                onClick={() => {
                  props.onPick(w.id)
                  setOpen(false)
                }}
              >
                {w.name}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
