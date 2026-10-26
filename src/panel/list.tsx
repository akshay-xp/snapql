import { type JSX, Show } from "solid-js"
import type { Entry } from "../capture/entry"
import { Clipped } from "./clipped"
import type { BodyHit } from "./filter"
import { rowLabel } from "./row"
import { Marked } from "./search"
import { VirtualListbox } from "./virtual-listbox"

export function List(props: {
  entries: readonly Entry[]
  query: string
  bodyHit: (entry: Entry) => BodyHit | undefined
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
            <Clipped
              parts={label.parts ?? ["", label.title]}
              title={entry.url}
              query={props.query}
              selected={selected()}
              class="flex-1"
            />
            <Show
              when={props.bodyHit(entry)}
              fallback={
                <Show when={label.detail}>
                  {(detail) => (
                    // Shrinks to half, unlike the other tags: socket subprotocols
                    // can be long tokens, and the title keeps priority.
                    <span
                      class="min-w-0 max-w-1/2 truncate"
                      classList={{ "text-muted": !selected() }}
                      title={detail()}
                    >
                      <Marked text={detail()} query={props.query} />
                    </span>
                  )}
                </Show>
              }
            >
              {(hit) => (
                <span
                  class="min-w-0 truncate"
                  classList={{ "text-muted": !selected() }}
                >
                  {hit().side} ({hit().count}):{" "}
                  <Marked text={hit().excerpt} query={props.query} />
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
            <Show when={label.closed}>
              <Muted selected={selected()}>{label.closed}</Muted>
            </Show>
            <Show when={label.count}>
              <Muted selected={selected()}>{label.count}</Muted>
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

// Muted on the selected row falls under 4.5:1, so selected rows drop it.
function Muted(props: { selected: boolean; children: JSX.Element }) {
  return (
    <span class="shrink-0" classList={{ "text-muted": !props.selected }}>
      {props.children}
    </span>
  )
}
