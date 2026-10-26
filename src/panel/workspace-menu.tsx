import { createSignal, For, onMount, Show } from "solid-js"
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
  const [editing, setEditing] = createSignal(false)
  const edit = () => {
    setOpen(false)
    setEditing(true)
  }
  const action = (label: string, run: () => void) => (
    <button type="button" role="menuitem" class={ITEM} onClick={run}>
      {label}
    </button>
  )
  return (
    <div ref={root} data-workspace class="relative shrink-0 pl-2">
      <Show
        when={editing()}
        fallback={
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
        }
      >
        <NameInput
          name={props.workspaces.name()}
          onDone={(name) => {
            if (name !== undefined) props.workspaces.rename(name)
            setEditing(false)
            button.focus()
          }}
        />
      </Show>
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
          <div class="my-1 h-px bg-border" />
          {action("New workspace", () => {
            props.workspaces.create()
            edit()
          })}
          {action("Rename", edit)}
          <Show when={props.workspaces.list().length > 1}>
            {action("Delete", () => {
              props.workspaces.remove()
              setOpen(false)
            })}
          </Show>
        </div>
      </Show>
    </div>
  )
}

// Enter or blur saves the typed name; Escape gives undefined (cancel).
function NameInput(props: {
  name: string
  onDone: (name: string | undefined) => void
}) {
  let input!: HTMLInputElement
  let done = false
  const finish = (name: string | undefined) => {
    if (done) return
    done = true
    props.onDone(name)
  }
  onMount(() => {
    input.focus()
    input.select()
  })
  return (
    <input
      ref={input}
      data-workspace-name
      aria-label="Workspace name"
      value={props.name}
      class="block w-32 rounded-full bg-surface px-2 py-0.5 outline-none ring-1 ring-accent"
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(input.value)
        if (e.key === "Escape") finish(undefined)
      }}
      onBlur={() => finish(input.value)}
    />
  )
}
