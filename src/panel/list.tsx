import { For, Show } from "solid-js"
import type { Entry } from "../capture/entry"
import { nextIndex } from "./keys"

export function List(props: {
  entries: readonly Entry[]
  selectedId: number | undefined
  onSelect: (id: number | undefined) => void
}) {
  const onKeyDown = (e: KeyboardEvent) => {
    const current = props.entries.findIndex((x) => x.id === props.selectedId)
    const next = nextIndex(
      e.key,
      current === -1 ? undefined : current,
      props.entries.length,
    )
    if (next === undefined) return
    e.preventDefault()
    props.onSelect(props.entries[next].id)
  }

  return (
    <div
      role="listbox"
      tabIndex={0}
      aria-label="Requests"
      aria-activedescendant={
        props.selectedId === undefined ? undefined : `entry-${props.selectedId}`
      }
      class="flex-1 overflow-y-auto outline-none"
      onKeyDown={onKeyDown}
    >
      <For each={props.entries}>
        {(entry) => (
          // Focus stays on the listbox (aria-activedescendant), which handles
          // the keyboard, so options are neither focusable nor key handlers.
          // biome-ignore lint/a11y/useFocusableInteractive: see above
          // biome-ignore lint/a11y/useKeyWithClickEvents: see above
          <div
            id={`entry-${entry.id}`}
            role="option"
            aria-selected={entry.id === props.selectedId}
            class="flex h-6 cursor-default items-center gap-2 border-b border-border px-2"
            classList={{
              "bg-selected": entry.id === props.selectedId,
              "text-error": entry.status >= 400,
            }}
            onClick={() => props.onSelect(entry.id)}
          >
            <span class="w-14 shrink-0">{entry.method}</span>
            <span class="w-10 shrink-0">{entry.status}</span>
            <Show
              when={entry.decoded}
              fallback={
                <span class="truncate" title={entry.url}>
                  {entry.url}
                </span>
              }
            >
              {(decoded) => (
                <>
                  <span class="shrink-0">{decoded().kind}</span>
                  <span class="truncate" title={entry.url}>
                    {decoded().summary}
                  </span>
                </>
              )}
            </Show>
          </div>
        )}
      </For>
    </div>
  )
}
