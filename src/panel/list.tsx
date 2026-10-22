import { createSignal, For, onCleanup, onMount, Show } from "solid-js"
import type { Entry } from "../capture/entry"
import { nextIndex } from "./keys"
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
            {(entry) => (
              // Focus stays on the listbox (aria-activedescendant), which handles
              // the keyboard, so options are neither focusable nor key handlers.
              // biome-ignore lint/a11y/useFocusableInteractive: see above
              // biome-ignore lint/a11y/useKeyWithClickEvents: see above
              <div
                id={`entry-${entry.id}`}
                role="option"
                aria-selected={entry.id === props.selectedId}
                class="flex h-7 cursor-default items-center gap-2 border-b border-border px-2"
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
                        {decoded().title}
                      </span>
                      <Show when={decoded().detail}>
                        <span class="shrink-0 text-muted">
                          {decoded().detail}
                        </span>
                      </Show>
                    </>
                  )}
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
