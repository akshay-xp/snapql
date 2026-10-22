import { createEffect, createSignal, For, on, Show } from "solid-js"
import {
  brackets,
  children,
  clip,
  OPEN_DEPTH,
  sizeLabel,
  startsOpen,
} from "./json"

export function JsonTree(props: { value: unknown; openDepth?: number }) {
  return (
    <div class="font-mono break-all">
      <Node
        value={props.value}
        depth={0}
        openDepth={props.openDepth ?? OPEN_DEPTH}
      />
    </div>
  )
}

function Node(props: {
  name?: string
  value: unknown
  depth: number
  openDepth: number
}) {
  const kids = children(props.value)
  const [open, setOpen] = createSignal(startsOpen(props.depth, props.openDepth))
  createEffect(
    on(
      () => props.openDepth,
      (openDepth) => setOpen(startsOpen(props.depth, openDepth)),
      { defer: true },
    ),
  )
  const key = (
    <Show when={props.name !== undefined}>
      <span data-json="key" class="text-syntax-key">
        {props.name}
      </span>
      <span class="text-muted">: </span>
    </Show>
  )
  if (!kids?.length)
    return (
      <div class="pl-[1.5ch]">
        {key}
        <Leaf value={props.value} />
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
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

function Leaf(props: { value: unknown }) {
  const v = props.value
  if (typeof v === "string")
    return (
      <span data-json="string" class="text-syntax-string">
        {JSON.stringify(clip(v).head)}
      </span>
    )
  if (v === null)
    return (
      <span data-json="null" class="text-muted">
        null
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
      {String(v)}
    </span>
  )
}
