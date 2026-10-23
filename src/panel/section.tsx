import { type JSX, Show } from "solid-js"
import { CopyButton } from "./copy-button"

export function Text(props: { children: string }) {
  return (
    <pre class="font-mono whitespace-pre-wrap [overflow-wrap:anywhere]">
      {props.children}
    </pre>
  )
}

export function Section(props: {
  title: string
  copy?: () => string
  children: JSX.Element
}) {
  return (
    <section class="flex flex-col gap-1.5">
      <div class="flex h-6 items-center justify-between">
        <h2 class="font-semibold text-muted">{props.title}</h2>
        <Show when={props.copy}>
          {(copy) => (
            <CopyButton label={`Copy ${props.title}`} value={copy()} />
          )}
        </Show>
      </div>
      <div data-block class="rounded-md bg-surface px-3 py-2">
        {props.children}
      </div>
    </section>
  )
}
