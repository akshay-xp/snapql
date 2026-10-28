import { highlightParts } from "./filter"
import type { Parts } from "./row"
import { Segments } from "./search"

// Clips the muted end (a query) first, then the leading part (the path), and
// the kept part (the last segment, which tells requests apart) only once both
// are gone. The end's huge shrink factor keeps the head's share below a pixel.
export function Clipped(props: {
  parts: Parts
  title: string
  query?: string
  selected?: boolean
  class?: string
}) {
  const parts = () => {
    const [head, tail, muted = ""] = props.parts
    return highlightParts([head, tail, muted], props.query ?? "")
  }
  return (
    <span
      data-clipped
      class={`flex min-w-0 ${props.class ?? ""}`}
      title={props.title}
    >
      <span data-head class="min-w-0 truncate">
        <Segments segments={parts()[0]} />
      </span>
      <span data-tail class="max-w-full shrink-0 truncate">
        <Segments segments={parts()[1]} />
      </span>
      <span
        data-end
        class="min-w-0 shrink-[1e9] truncate"
        classList={{ "text-muted": !props.selected }}
      >
        <Segments segments={parts()[2]} />
      </span>
    </span>
  )
}
