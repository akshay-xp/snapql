import { createEffect, createSignal, For, on, Show } from "solid-js"
import {
  brackets,
  children,
  clip,
  hasMatch,
  OPEN_DEPTH,
  sizeLabel,
  startsOpen,
} from "./json"
import { Marked } from "./search"

export function JsonTree(props: {
  value: unknown
  openDepth?: number
  query?: string
}) {
  return (
    <div class="font-mono [overflow-wrap:anywhere]">
      <Node
        value={props.value}
        depth={0}
        openDepth={props.openDepth ?? OPEN_DEPTH}
        query={props.query ?? ""}
      />
    </div>
  )
}

function Node(props: {
  name?: string
  value: unknown
  depth: number
  openDepth: number
  query: string
}) {
  const kids = children(props.value)
  // Nodes holding a match open while it's searched, and close again after.
  const startOpen = () =>
    startsOpen(props.depth, props.openDepth) ||
    hasMatch(props.value, props.query)
  const [open, setOpen] = createSignal(startOpen())
  createEffect(on(startOpen, setOpen, { defer: true }))
  const key = (
    <Show when={props.name !== undefined}>
      <span data-json="key" class="text-syntax-key">
        <Marked text={props.name ?? ""} query={props.query} />
      </span>
      <span class="text-muted">: </span>
    </Show>
  )
  if (!kids?.length)
    return (
      <div class="pl-[1.5ch]">
        {key}
        <Leaf value={props.value} query={props.query} />
      </div>
    )
  return (
    <div>
      <div class="flex">
        <button
          type="button"
          aria-expanded={open()}
          aria-label={props.name ?? "JSON"}
          class="w-[1.5ch] shrink-0 text-left text-muted"
          onClick={() => setOpen(!open())}
        >
          {open() ? "▾" : "▸"}
        </button>
        <span>
          {key}
          <span class="text-muted">
            {open()
              ? brackets(props.value as object)
              : sizeLabel(props.value as object)}
          </span>
        </span>
      </div>
      <Show when={open()}>
        <div class="pl-4">
          <For each={kids}>
            {([name, value]) => (
              <Node
                name={name}
                value={value}
                depth={props.depth + 1}
                openDepth={props.openDepth}
                query={props.query}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

function Leaf(props: { value: unknown; query: string }) {
  const v = props.value
  if (typeof v === "string") return <StringLeaf value={v} query={props.query} />
  if (v === null)
    return (
      <span data-json="null" class="text-muted">
        <Marked text="null" query={props.query} />
      </span>
    )
  if (typeof v === "object")
    return (
      <span data-json="empty" class="text-muted">
        {sizeLabel(v)}
      </span>
    )
  return (
    <span data-json="number" class="text-syntax-number">
      <Marked text={String(v)} query={props.query} />
    </span>
  )
}

function StringLeaf(props: { value: string; query: string }) {
  const [full, setFull] = createSignal(false)
  const clipped = () => clip(props.value)
  return (
    <>
      <span data-json="string" class="text-syntax-string">
        <Marked
          text={JSON.stringify(full() ? props.value : clipped().head)}
          query={props.query}
        />
      </span>
      <Show when={clipped().clipped && !full()}>
        …
        <button
          type="button"
          class="font-sans text-accent"
          onClick={() => setFull(true)}
        >
          show more
        </button>
      </Show>
    </>
  )
}
