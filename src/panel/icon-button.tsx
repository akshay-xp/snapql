import type { JSX } from "solid-js"

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
      class="flex h-6 min-w-6 items-center justify-center gap-1 rounded px-1 text-muted hover:bg-selected hover:text-fg"
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
      {props.caption}
    </button>
  )
}
