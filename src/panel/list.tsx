import { createSignal, For, onCleanup, onMount, Show } from "solid-js"
import type { Entry } from "../capture/entry"
import { nextIndex } from "./keys"
import { rowLabel } from "./row"
import { scrollToRow, visibleRange } from "./virtual"

// Must match the rows' h-7 class (border-box, so the border is included).
export const ROW_HEIGHT = 28
const OVERSCAN = 10

export function List(props: {
  entries: readonly Entry[]
  selectedId: number | undefined
  onSelect: (id: number | undefined) => void
}) {
  let el!: HTMLDivElement
  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewportHeight, setViewportHeight] = createSignal(0)
  onMount(() => {
    const observer = new ResizeObserver(() =>
      setViewportHeight(el.clientHeight),
    )
    observer.observe(el)
    onCleanup(() => observer.disconnect())
  })
  const range = () =>
    visibleRange(
      scrollTop(),
      viewportHeight(),
      ROW_HEIGHT,
      props.entries.length,
      OVERSCAN,
    )

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return props.onSelect(undefined)
    const current = props.entries.findIndex((x) => x.id === props.selectedId)
    const next = nextIndex(
      e.key,
      current === -1 ? undefined : current,
      props.entries.length,
    )
    if (next === undefined) return
    e.preventDefault()
    props.onSelect(props.entries[next].id)
    // Reveal the row so it is rendered and aria-activedescendant resolves.
    const top = scrollToRow(next, el.scrollTop, el.clientHeight, ROW_HEIGHT)
    if (top !== undefined) el.scrollTop = top
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
      ref={el}
      onScroll={() => setScrollTop(el.scrollTop)}
      onKeyDown={onKeyDown}
    >
      <div style={{ height: `${props.entries.length * ROW_HEIGHT}px` }}>
        <div
          style={{ transform: `translateY(${range().start * ROW_HEIGHT}px)` }}
        >
          <For each={props.entries.slice(range().start, range().end)}>
            {(entry) => {
              const selected = () => entry.id === props.selectedId
              const label = rowLabel(entry)
              return (
                // Focus stays on the listbox (aria-activedescendant), which handles
                // the keyboard, so options are neither focusable nor key handlers.
                // biome-ignore lint/a11y/useFocusableInteractive: see above
                // biome-ignore lint/a11y/useKeyWithClickEvents: see above
                <div
                  id={`entry-${entry.id}`}
                  role="option"
                  aria-selected={selected()}
                  class="flex h-7 cursor-default items-center gap-2 border-b border-border px-2"
                  classList={{ "bg-selected": selected() }}
                  onClick={() => props.onSelect(entry.id)}
                >
                  <span class="min-w-0 flex-1 truncate" title={entry.url}>
                    {label.title}
                  </span>
                  <Show when={label.detail}>
                    <span
                      class="shrink-0"
                      classList={{ "text-muted": !selected() }}
                    >
                      {label.detail}
                    </span>
                  </Show>
                  <Show when={label.failure}>
                    <span class="shrink-0 rounded bg-error px-1 font-semibold text-bg">
                      {label.failure}
                    </span>
                  </Show>
                  {/* Present but empty when undecoded, so tags align in a column. */}
                  <span
                    class="w-16 shrink-0 rounded border text-center"
                    classList={{
                      "border-border": !!label.kind,
                      "border-transparent": !label.kind,
                      "text-muted": !selected(),
                    }}
                  >
                    {label.kind}
                  </span>
                </div>
              )
            }}
          </For>
        </div>
      </div>
    </div>
  )
}
