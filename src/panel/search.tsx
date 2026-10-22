import { Show } from "solid-js"
import { IconButton } from "./icon-button"

export function SearchBox(props: {
  query: string
  onQuery: (query: string) => void
}) {
  return (
    <div class="flex h-10 shrink-0 items-center border-b border-border px-2">
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
        <Show when={props.query}>
          <IconButton label="Clear filter" onClick={() => props.onQuery("")}>
            <path d="M6 6l12 12M18 6 6 18" />
          </IconButton>
        </Show>
      </label>
    </div>
  )
}
