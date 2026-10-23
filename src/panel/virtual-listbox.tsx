import { createSignal, For, type JSX, onCleanup, onMount } from "solid-js"
import { nextIndex } from "./keys"
import { scrollToRow, visibleRange } from "./virtual"

// Must match the rows' h-7 class (border-box, so the border is included).
export const ROW_HEIGHT = 28
const OVERSCAN = 10

export function VirtualListbox<T>(props: {
  items: readonly T[]
  key: (item: T) => number
  selected: number | undefined
  onSelect: (key: number | undefined) => void
  label: string
  idPrefix: string
  children: (item: T, selected: () => boolean) => JSX.Element
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
      props.items.length,
      OVERSCAN,
    )

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return props.onSelect(undefined)
    const current = props.items.findIndex(
      (x) => props.key(x) === props.selected,
    )
    const next = nextIndex(
      e.key,
      current === -1 ? undefined : current,
      props.items.length,
    )
    if (next === undefined) return
    e.preventDefault()
    props.onSelect(props.key(props.items[next]))
    // Reveal the row so it is rendered and aria-activedescendant resolves.
    const top = scrollToRow(next, el.scrollTop, el.clientHeight, ROW_HEIGHT)
    if (top !== undefined) el.scrollTop = top
  }

  return (
    <div
      role="listbox"
      tabIndex={0}
      aria-label={props.label}
      aria-activedescendant={
        props.selected === undefined
          ? undefined
          : `${props.idPrefix}${props.selected}`
      }
      class="flex-1 overflow-y-auto outline-none"
      ref={el}
      onScroll={() => setScrollTop(el.scrollTop)}
      onKeyDown={onKeyDown}
    >
      <div style={{ height: `${props.items.length * ROW_HEIGHT}px` }}>
        <div
          style={{ transform: `translateY(${range().start * ROW_HEIGHT}px)` }}
        >
          <For each={props.items.slice(range().start, range().end)}>
            {(item) => {
              const selected = () => props.key(item) === props.selected
              return (
                // Focus stays on the listbox (aria-activedescendant), which handles
                // the keyboard, so options are neither focusable nor key handlers.
                // biome-ignore lint/a11y/useFocusableInteractive: see above
                // biome-ignore lint/a11y/useKeyWithClickEvents: see above
                <div
                  id={`${props.idPrefix}${props.key(item)}`}
                  role="option"
                  aria-selected={selected()}
                  class="flex h-7 cursor-default items-center gap-2 border-b border-border px-2 font-mono"
                  classList={{ "bg-selected": selected() }}
                  onClick={() => props.onSelect(props.key(item))}
                >
                  {props.children(item, selected)}
                </div>
              )
            }}
          </For>
        </div>
      </div>
    </div>
  )
}
