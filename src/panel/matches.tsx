import { createEffect, createSignal, on, Show } from "solid-js"
import { IconButton } from "./icon-button"

export type Step = { by: 1 | -1 }

export function createMatches(
  root: () => HTMLElement | undefined,
  deps: () => unknown,
  step: () => Step | undefined,
) {
  const [marks, setMarks] = createSignal<Element[]>([])
  const [index, setIndex] = createSignal(0)
  const show = (i: number) => {
    marks().forEach((m, j) => {
      m.toggleAttribute("data-current", j === i)
    })
    const mark = marks()[i]
    // Not scrollIntoView: it also scrolls DevTools' container around the
    // panel frame, shifting the whole panel up.
    const pane = mark?.closest('[role="tabpanel"]')
    if (mark && pane) {
      const box = mark.getBoundingClientRect()
      const view = pane.getBoundingClientRect()
      pane.scrollTop += box.top - view.top - (view.height - box.height) / 2
    }
    setIndex(i)
  }
  const move = (by: 1 | -1) => {
    const n = marks().length
    if (n) show((index() + by + n) % n)
  }
  // After a microtask, so tree nodes opened by their own effects are counted.
  createEffect(
    on(deps, () =>
      queueMicrotask(() => {
        setMarks([...(root()?.querySelectorAll("mark") ?? [])])
        show(0)
      }),
    ),
  )
  createEffect(on(step, (s) => s && move(s.by), { defer: true }))
  return { index, count: () => marks().length, move }
}

export function MatchNav(props: {
  index: number
  count: number
  onMove: (by: 1 | -1) => void
}) {
  return (
    <Show when={props.count}>
      <span data-match-nav class="self-center text-muted">
        Match {props.index + 1} of {props.count}
      </span>
      <IconButton
        label="Previous match (Shift+Enter)"
        onClick={() => props.onMove(-1)}
      >
        <path d="m18 15-6-6-6 6" />
      </IconButton>
      <IconButton label="Next match (Enter)" onClick={() => props.onMove(1)}>
        <path d="m6 9 6 6 6-6" />
      </IconButton>
    </Show>
  )
}
