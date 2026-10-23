import { Show } from "solid-js"
import type { Entry } from "../capture/entry"
import { rowLabel } from "./row"
import { Marked } from "./search"
import { VirtualListbox } from "./virtual-listbox"

export function List(props: {
  entries: readonly Entry[]
  query: string
  selectedId: number | undefined
  onSelect: (id: number | undefined) => void
}) {
  return (
    <VirtualListbox
      items={props.entries}
      key={(entry) => entry.id}
      selected={props.selectedId}
      onSelect={props.onSelect}
      label="Requests"
      idPrefix="entry-"
    >
      {(entry, selected) => {
        const label = rowLabel(entry)
        return (
          <>
            <span class="min-w-0 flex-1 truncate" title={entry.url}>
              <Marked text={label.title} query={props.query} />
            </span>
            <Show when={label.detail}>
              {(detail) => (
                <span
                  class="shrink-0"
                  classList={{ "text-muted": !selected() }}
                >
                  <Marked text={detail()} query={props.query} />
                </span>
              )}
            </Show>
            <Show when={label.failure}>
              <span class="shrink-0 rounded bg-error px-1 font-semibold text-bg">
                {label.failure}
              </span>
            </Show>
            <Show when={label.live}>
              <span class="shrink-0" classList={{ "text-accent": !selected() }}>
                live
              </span>
            </Show>
            <Show when={label.count}>
              <span class="shrink-0" classList={{ "text-muted": !selected() }}>
                {label.count}
              </span>
            </Show>
            {/* Present but empty when undecoded, so tags align in a column. */}
            <span
              class="w-[11ch] shrink-0 rounded border text-center"
              classList={{
                "border-border": !!label.kind,
                "border-transparent": !label.kind,
                "text-muted": !selected(),
              }}
            >
              {label.kind}
            </span>
          </>
        )
      }}
    </VirtualListbox>
  )
}
