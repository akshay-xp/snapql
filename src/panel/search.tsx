import { createSignal, For, type JSX, Show } from "solid-js"
import { type Filters, type Hide, highlight } from "./filter"
import { IconButton } from "./icon-button"

export function SearchBox(props: {
  query: string
  onQuery: (query: string) => void
  searchBodies: boolean
  onSearchBodies: (on: boolean) => void
  onStep: (by: 1 | -1) => void
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
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            e.preventDefault()
            props.onStep(e.shiftKey ? -1 : 1)
          }}
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
  hide: Hide
  onHide: (hide: Hide) => void
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
    <div class="flex h-8 shrink-0 items-center border-b border-border pr-2">
      <fieldset
        aria-label="Filters"
        class="flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2"
      >
        {group("kinds")}
        <span aria-hidden="true" class="mx-1 h-4 w-px shrink-0 bg-border" />
        {group("statuses")}
      </fieldset>
      <HideMenu hide={props.hide} onChange={props.onHide} />
    </div>
  )
}

const HIDE_OPTIONS: [keyof Hide, string][] = [
  ["preflights", "Preflights"],
  ["cached", "Cached"],
  ["assets", "Static assets"],
]

// Outside the scrolling chips, which would clip the popover.
function HideMenu(props: { hide: Hide; onChange: (hide: Hide) => void }) {
  const [open, setOpen] = createSignal(false)
  const on = () => HIDE_OPTIONS.filter(([key]) => props.hide[key]).length
  return (
    <div data-hide class="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open()}
        class="rounded-full px-2 py-0.5"
        classList={{
          "bg-accent/20 text-accent": on() > 0,
          "bg-surface": on() === 0,
        }}
        onClick={() => setOpen(!open())}
      >
        {on() ? `Hide (${on()})` : "Hide"}
      </button>
      <Show when={open()}>
        <div
          data-hide-menu
          role="menu"
          class="absolute top-full right-0 z-10 mt-1 flex w-40 flex-col gap-1 rounded-md border border-border bg-bg p-2 shadow-lg"
        >
          <For each={HIDE_OPTIONS}>
            {([key, label]) => (
              <label class="flex items-center gap-2">
                <input
                  type="checkbox"
                  role="menuitemcheckbox"
                  aria-checked={props.hide[key]}
                  class="accent-accent"
                  value={key}
                  checked={props.hide[key]}
                  onChange={(e) =>
                    props.onChange({
                      ...props.hide,
                      [key]: e.currentTarget.checked,
                    })
                  }
                />
                {label}
              </label>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
