import { For, type JSX, Show } from "solid-js"
import { type Filters, highlight } from "./filter"
import { IconButton } from "./icon-button"

export function SearchBox(props: {
  query: string
  onQuery: (query: string) => void
  searchBodies: boolean
  onSearchBodies: (on: boolean) => void
}) {
  return (
    <search class="flex h-10 shrink-0 items-center border-b border-border px-2">
      <label class="flex h-7 flex-1 items-center gap-1.5 rounded-md bg-surface pr-0.5 pl-2 text-muted focus-within:ring-1 focus-within:ring-accent">
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder={
            props.searchBodies
              ? "Filter requests and bodies"
              : "Filter requests"
          }
          aria-label="Filter requests"
          class="min-w-0 flex-1 bg-transparent text-fg outline-none [&::-webkit-search-cancel-button]:hidden"
          value={props.query}
          onInput={(e) => props.onQuery(e.currentTarget.value)}
        />
        <Pill
          title="Also match text inside request and response bodies. Matches show an excerpt in the list."
          class="ring-1 ring-border ring-inset"
          pressed={props.searchBodies}
          onClick={() => props.onSearchBodies(!props.searchBodies)}
        >
          Include bodies
        </Pill>
        <Show when={props.query}>
          <IconButton label="Clear filter" onClick={() => props.onQuery("")}>
            <path d="M6 6l12 12M18 6 6 18" />
          </IconButton>
        </Show>
      </label>
    </search>
  )
}

export function Marked(props: { text: string; query: string }) {
  return (
    <For each={highlight(props.text, props.query)}>
      {(segment) =>
        segment.hit ? (
          <mark class="rounded-sm bg-accent/30 text-inherit data-current:bg-accent data-current:text-bg">
            {segment.text}
          </mark>
        ) : (
          segment.text
        )
      }
    </For>
  )
}

function Pill(props: {
  pressed: boolean
  title?: string
  class?: string
  onClick: () => void
  children: JSX.Element
}) {
  return (
    <button
      type="button"
      title={props.title}
      aria-pressed={props.pressed}
      class={`shrink-0 rounded-full px-2 py-0.5 font-mono ${props.class ?? ""}`}
      classList={{
        "bg-accent/20 text-accent": props.pressed,
        "bg-surface": !props.pressed,
      }}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

export function FilterChips(props: {
  chips: Filters
  active: Filters
  onToggle: (group: keyof Filters, value: string) => void
}) {
  const group = (name: keyof Filters) => (
    <For each={props.chips[name]}>
      {(value) => (
        <Pill
          pressed={props.active[name].includes(value)}
          onClick={() => props.onToggle(name, value)}
        >
          {value}
        </Pill>
      )}
    </For>
  )
  return (
    <fieldset
      aria-label="Filters"
      class="flex h-8 min-w-0 shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2"
    >
      {group("kinds")}
      <span aria-hidden="true" class="mx-1 h-4 w-px shrink-0 bg-border" />
      {group("statuses")}
    </fieldset>
  )
}
