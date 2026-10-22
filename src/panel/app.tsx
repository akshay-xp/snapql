import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from "solid-js"
import type { Store } from "../capture/store"
import { Detail } from "./detail"
import { matchesQuery } from "./filter"
import { Footer } from "./footer"
import { List } from "./list"
import { SearchBox } from "./search"
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
  const [query, setQuery] = createSignal("")
  const visible = createMemo(() => {
    const shown = entries().filter((e) => matchesQuery(e, query()))
    return newestFirst() ? shown.reverse() : shown
  })
  // Undefined until the first drag: the pane takes half the width. Not persisted.
  const [detailWidth, setDetailWidth] = createSignal<number>()
  let row!: HTMLDivElement
  const selected = () => visible().find((e) => e.id === selectedId())
  // Clear, eviction, navigation or the filter can remove the selected entry;
  // close with it.
  createEffect(() => {
    if (selectedId() !== undefined && !selected()) setSelectedId(undefined)
  })

  return (
    <main class="flex h-dvh flex-col font-sans text-xs">
      <div class="flex min-h-0 flex-1" ref={row}>
        <section class="flex min-w-0 flex-1 flex-col">
          <SearchBox query={query()} onQuery={setQuery} />
          <Show when={entries().length} fallback={<Waiting />}>
            <Show
              when={visible().length}
              fallback={
                <NoMatches query={query()} onClear={() => setQuery("")} />
              }
            >
              <List
                entries={visible()}
                query={query()}
                selectedId={selectedId()}
                onSelect={setSelectedId}
              />
            </Show>
          </Show>
          <Footer
            count={visible().length}
            total={query() ? entries().length : undefined}
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

function Message(props: { children: JSX.Element }) {
  return (
    <div class="flex flex-1 flex-col items-center justify-center gap-1.5 p-4 text-center">
      {props.children}
    </div>
  )
}

function Waiting() {
  return (
    <Message>
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
    </Message>
  )
}

function NoMatches(props: { query: string; onClear: () => void }) {
  return (
    <Message>
      <p class="text-[13px] font-semibold">No requests match "{props.query}"</p>
      <button
        type="button"
        class="text-accent underline"
        onClick={props.onClear}
      >
        Clear filter
      </button>
    </Message>
  )
}
