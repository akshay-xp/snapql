import { highlightParts } from "./filter"
import type { Parts } from "./row"
import { Segments } from "./search"

// The leading part clips first; the kept part and the muted end only clip once
// it is gone, since the end of a URL is what tells requests apart.
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
        <span classList={{ "text-muted": !props.selected }}>
          <Segments segments={parts()[2]} />
        </span>
      </span>
    </span>
  )
}
