import { For, Show } from "solid-js"
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
          placeholder="Filter requests"
          aria-label="Filter requests"
          class="min-w-0 flex-1 bg-transparent text-fg outline-none [&::-webkit-search-cancel-button]:hidden"
          value={props.query}
          onInput={(e) => props.onQuery(e.currentTarget.value)}
        />
        <IconButton
          label="Search bodies"
          pressed={props.searchBodies}
          onClick={() => props.onSearchBodies(!props.searchBodies)}
        >
          <path d="M14 3H6v18h12V7zM14 3v4h4M9 12h6M9 16h6" />
        </IconButton>
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
          <mark class="rounded-sm bg-accent/30 text-inherit">
            {segment.text}
          </mark>
        ) : (
          segment.text
        )
      }
    </For>
  )
}

export function FilterChips(props: {
  chips: Filters
  active: Filters
  onToggle: (group: keyof Filters, value: string) => void
}) {
  const group = (name: keyof Filters) => (
    <For each={props.chips[name]}>
      {(value) => {
        const pressed = () => props.active[name].includes(value)
        return (
          <button
            type="button"
            aria-pressed={pressed()}
            class="shrink-0 rounded-full bg-surface px-2 py-0.5 font-mono"
            classList={{ "bg-accent/20 text-accent": pressed() }}
            onClick={() => props.onToggle(name, value)}
          >
            {value}
          </button>
        )
      }}
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
