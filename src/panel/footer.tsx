import type { JSX } from "solid-js"
import { count } from "../decoders/text"

export function Footer(props: {
  count: number
  onClear: () => void
  newestFirst: boolean
  onSort: () => void
  preserveLog: boolean
  onPreserveLog: (on: boolean) => void
}) {
  return (
    <footer class="flex h-8 shrink-0 items-center gap-0.5 border-t border-border px-1.5">
      <IconButton label="Clear" onClick={props.onClear}>
        <circle cx="12" cy="12" r="9" />
        <path d="m5.6 5.6 12.8 12.8" />
      </IconButton>
      <IconButton
        label={props.newestFirst ? "Newest first" : "Oldest first"}
        onClick={props.onSort}
      >
        <path
          d={
            props.newestFirst
              ? "M7 20V4M3 8l4-4 4 4M14 6h7M14 12h5M14 18h3"
              : "M7 4v16M3 16l4 4 4-4M14 6h3M14 12h5M14 18h7"
          }
        />
      </IconButton>
      <IconButton
        label="Preserve log"
        pressed={props.preserveLog}
        onClick={() => props.onPreserveLog(!props.preserveLog)}
      >
        <path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z" />
      </IconButton>
      <span class="ml-auto pr-1 text-muted">
        {count(props.count, "request")}
      </span>
    </footer>
  )
}

function IconButton(props: {
  label: string
  pressed?: boolean
  onClick: () => void
  children: JSX.Element
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed}
      class="flex size-6 items-center justify-center rounded text-muted hover:bg-selected hover:text-fg"
      classList={{ "text-accent": props.pressed }}
      onClick={props.onClick}
    >
      <svg
        aria-hidden="true"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        {props.children}
      </svg>
    </button>
  )
}
