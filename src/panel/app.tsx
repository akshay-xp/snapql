import {
  type Accessor,
  createEffect,
  createSignal,
  onCleanup,
  Show,
} from "solid-js"
import type { Store } from "../capture/store"
import { Detail } from "./detail"
import { Footer } from "./footer"
import { List } from "./list"
import { clampWidth } from "./splitter"

export function App(props: {
  store: Store
  preserveLog: Accessor<boolean>
  setPreserveLog: (on: boolean) => void
}) {
  const [entries, setEntries] = createSignal(props.store.snapshot())
  onCleanup(props.store.subscribe(() => setEntries(props.store.snapshot())))
  const [selectedId, setSelectedId] = createSignal<number>()
  const [newestFirst, setNewestFirst] = createSignal(true)
  // Undefined until the first drag: the pane takes half the width. Not persisted.
  const [detailWidth, setDetailWidth] = createSignal<number>()
  let row!: HTMLDivElement
  const selected = () => entries().find((e) => e.id === selectedId())
  // Clear, eviction or navigation can remove the selected entry; close with it.
  createEffect(() => {
    if (selectedId() !== undefined && !selected()) setSelectedId(undefined)
  })

  return (
    <main class="flex h-dvh flex-col font-sans text-xs">
      <div class="flex min-h-0 flex-1" ref={row}>
        <section class="flex min-w-0 flex-1 flex-col">
          <Show when={entries().length} fallback={<Waiting />}>
            <List
              entries={newestFirst() ? [...entries()].reverse() : entries()}
              selectedId={selectedId()}
              onSelect={setSelectedId}
            />
          </Show>
          <Footer
            count={entries().length}
            onClear={() => props.store.clear()}
            newestFirst={newestFirst()}
            onSort={() => setNewestFirst(!newestFirst())}
            preserveLog={props.preserveLog()}
            onPreserveLog={props.setPreserveLog}
          />
        </section>
        <Show when={selected()}>
          {(entry) => (
            <Detail
              entry={entry()}
              width={detailWidth()}
              onResize={(clientX) => {
                const box = row.getBoundingClientRect()
                setDetailWidth(clampWidth(box.right - clientX, box.width))
              }}
            />
          )}
        </Show>
      </div>
    </main>
  )
}

function Waiting() {
  return (
    <div class="flex flex-1 flex-col items-center justify-center gap-1.5 p-4 text-center">
      <svg
        aria-hidden="true"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-muted"
      >
        <path d="M3 12h4l3-8 4 16 3-8h4" />
      </svg>
      <p class="text-[13px] font-semibold">Waiting for requests</p>
      <p class="text-muted">Reload the page to capture its traffic.</p>
    </div>
  )
}
