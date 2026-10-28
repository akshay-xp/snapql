import { type JSX, Show } from "solid-js"

export function IconButton(props: {
  label: string
  pressed?: boolean
  caption?: string
  onClick: () => void
  children: JSX.Element
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed}
      class="flex h-6 min-w-6 items-center justify-center gap-1 rounded px-1 hover:bg-selected hover:text-fg"
      // One color class per state: with both, CSS order decides, and muted wins.
      classList={{
        "bg-accent/20 text-accent": props.pressed,
        "text-muted": !props.pressed,
      }}
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
      <Show when={props.caption}>
        <span data-caption>{props.caption}</span>
      </Show>
    </button>
  )
}
