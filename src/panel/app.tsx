import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
import { version } from "../../package.json"
import type { Entry } from "../capture/entry"
import type { Store } from "../capture/store"
import { createBodyIndex } from "./body-index"
import { Detail } from "./detail"
import { download } from "./download"
import {
  bodyHit,
  chipsFor,
  defaultHide,
  isHidden,
  matchesFilters,
  matchesQuery,
  noFilters,
  toggle,
} from "./filter"
import { Footer } from "./footer"
import { harFileName, toHar } from "./har"
import { List } from "./list"
import type { Step } from "./matches"
import { redactHar } from "./redact"
import type { Schemas } from "./schemas"
import { FilterChips, SearchBox } from "./search"
import { clampSize, isStacked } from "./splitter"
import type { Tab } from "./tabs"

export function App(props: {
  store: Store
  preserveLog: Accessor<boolean>
  setPreserveLog: (on: boolean) => void
  // Reloads with the probe injected first, so streams opened while loading are live.
  onReloadCapture: () => void
  schemas: Schemas
}) {
  const [entries, setEntries] = createSignal(props.store.snapshot())
  onCleanup(props.store.subscribe(() => setEntries(props.store.snapshot())))
  const [selectedId, setSelectedId] = createSignal<number>()
  const [newestFirst, setNewestFirst] = createSignal(true)
  const [query, setQuery] = createSignal("")
  const [filters, setFilters] = createSignal(noFilters)
  const [hide, setHide] = createSignal(defaultHide)
  const chips = createMemo(() => chipsFor(entries(), filters()))
  const filtered = () =>
    !!query() ||
    !!filters().kinds.length ||
    !!filters().statuses.length ||
    entries().some((e) => isHidden(e, hide()))
  const clearFilters = () => {
    setQuery("")
    setFilters(noFilters)
  }
  const [searchBodies, setSearchBodies] = createSignal(false)
  const [bodyVersion, setBodyVersion] = createSignal(0)
  const bodies = createBodyIndex(() => setBodyVersion((v) => v + 1))
  createEffect(() => bodies.sync(entries(), searchBodies()))
  const bodyText = (entry: Entry) => {
    const texts = bodies.text(entry)
    return texts && `${texts.request}\n${texts.response}`
  }
  const visible = createMemo(() => {
    bodyVersion()
    const shown = entries().filter(
      (e) =>
        matchesQuery(e, query(), searchBodies() ? bodyText(e) : undefined) &&
        matchesFilters(e, filters()) &&
        !isHidden(e, hide()),
    )
    return newestFirst() ? shown.reverse() : shown
  })
  const bodyQuery = () => (searchBodies() ? query() : "")
  // Only for rows that matched in a body alone, which have nothing to highlight.
  const hitOf = (entry: Entry) => {
    bodyVersion()
    const texts = bodies.text(entry)
    return bodyQuery() && texts && !matchesQuery(entry, query())
      ? bodyHit(texts, query())
      : undefined
  }
  const [stepMatch, setStepMatch] = createSignal<Step>()
  // A fresh object per selection, so picking the same tab again still applies.
  const [openTab, setOpenTab] = createSignal<{ tab: Tab }>()
  const select = (id: number | undefined) => {
    const entry = visible().find((e) => e.id === id)
    const hit = entry && hitOf(entry)
    setOpenTab(hit && { tab: hit.side === "response" ? "Body" : "Raw" })
    setSelectedId(id)
  }
  // Undefined until the first drag: the pane takes half the panel. Not persisted.
  const [detailWidth, setDetailWidth] = createSignal<number>()
  const [detailHeight, setDetailHeight] = createSignal<number>()
  const [stacked, setStacked] = createSignal(false)
  let row!: HTMLDivElement
  onMount(() => {
    // Next frame: relaying out inside the callback raises "ResizeObserver
    // loop completed with undelivered notifications".
    const observer = new ResizeObserver(() =>
      requestAnimationFrame(() =>
        setStacked(isStacked(row.clientWidth, row.clientHeight)),
      ),
    )
    observer.observe(row)
    onCleanup(() => observer.disconnect())
  })
  // Oldest first, as HAR viewers expect, whatever the list order.
  const exportHar = async (redact: boolean) => {
    const shown = [...visible()].sort((a, b) => a.startedAt - b.startedAt)
    const bodies = await Promise.all(
      shown.map((e) => e.getBody().catch(() => undefined)),
    )
    const har = toHar(shown, bodies, version)
    download(
      JSON.stringify(redact ? redactHar(har) : har, null, 2),
      harFileName(shown, new Date()),
    )
  }
  const selected = () => visible().find((e) => e.id === selectedId())
  // Clear, eviction, navigation or the filter can remove the selected entry;
  // close with it.
  createEffect(() => {
    if (selectedId() !== undefined && !selected()) setSelectedId(undefined)
  })

  return (
    <main class="flex h-dvh flex-col font-sans text-xs">
      <div
        class="flex min-h-0 flex-1"
        classList={{ "flex-col": stacked() }}
        ref={row}
      >
        <section class="flex min-h-0 min-w-0 flex-1 flex-col">
          <SearchBox
            query={query()}
            onQuery={setQuery}
            searchBodies={searchBodies()}
            onSearchBodies={setSearchBodies}
            onStep={(by) => setStepMatch({ by })}
          />
          <Show when={entries().length}>
            <FilterChips
              chips={chips()}
              active={filters()}
              onToggle={(group, value) =>
                setFilters(toggle(filters(), group, value))
              }
              hide={hide()}
              onHide={setHide}
            />
          </Show>
          <Show
            when={entries().length}
            fallback={<Waiting onReloadCapture={props.onReloadCapture} />}
          >
            <Show
              when={visible().length}
              fallback={<NoMatches query={query()} onClear={clearFilters} />}
            >
              <List
                entries={visible()}
                query={query()}
                bodyHit={hitOf}
                selectedId={selectedId()}
                onSelect={select}
              />
            </Show>
          </Show>
          <Footer
            count={visible().length}
            total={filtered() ? entries().length : undefined}
            onClear={() => props.store.clear()}
            newestFirst={newestFirst()}
            onSort={() => setNewestFirst(!newestFirst())}
            preserveLog={props.preserveLog()}
            onPreserveLog={props.setPreserveLog}
            onReloadCapture={props.onReloadCapture}
            schemas={props.schemas}
            exportCount={visible().length}
            onExportHar={exportHar}
          />
        </section>
        <Show when={selected()}>
          {(entry) => (
            <Detail
              entry={entry()}
              schemas={props.schemas}
              bodyQuery={bodyQuery()}
              openTab={openTab()}
              stepMatch={stepMatch()}
              stacked={stacked()}
              size={stacked() ? detailHeight() : detailWidth()}
              onResize={(clientX, clientY) => {
                const box = row.getBoundingClientRect()
                if (stacked())
                  setDetailHeight(clampSize(box.bottom - clientY, box.height))
                else setDetailWidth(clampSize(box.right - clientX, box.width))
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

function Waiting(props: { onReloadCapture: () => void }) {
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
      <button
        type="button"
        class="text-accent underline"
        onClick={props.onReloadCapture}
      >
        Reload and capture
      </button>
    </Message>
  )
}

function NoMatches(props: { query: string; onClear: () => void }) {
  return (
    <Message>
      <p class="text-[13px] font-semibold">
        {props.query
          ? `No requests match "${props.query}"`
          : "No requests match the filters"}
      </p>
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
