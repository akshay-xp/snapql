import { For } from "solid-js"
import type { Entry } from "../capture/entry"
import { dataSections } from "./summary"

export function Detail(props: { entry: Entry }) {
  return (
    <section class="flex w-1/2 flex-col border-l border-border">
      <div role="tablist" class="flex border-b border-border">
        <button
          type="button"
          role="tab"
          id="tab-summary"
          aria-selected="true"
          aria-controls="panel-summary"
          class="border-b-2 border-fg px-2 py-1"
        >
          Summary
        </button>
      </div>
      <div
        role="tabpanel"
        id="panel-summary"
        aria-labelledby="tab-summary"
        class="flex-1 overflow-auto p-2"
      >
        <Summary entry={props.entry} />
      </div>
    </section>
  )
}

function Summary(props: { entry: Entry }) {
  const fields = () => {
    const e = props.entry
    return [
      ["Method", e.method],
      ["URL", e.url],
      ["Status", String(e.status)],
      ["Kind", e.decoded?.kind],
      ["Summary", e.decoded?.summary],
      ["Started", new Date(e.startedAt).toISOString()],
      ["Time", `${Math.round(e.time)} ms`],
    ].filter((f): f is [string, string] => f[1] !== undefined)
  }

  return (
    <>
      <dl class="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
        <For each={fields()}>
          {([name, value]) => (
            <>
              <dt class="text-muted">{name}</dt>
              <dd class="break-all">{value}</dd>
            </>
          )}
        </For>
      </dl>
      <For each={dataSections(props.entry.decoded?.data)}>
        {(section) => (
          <section class="mt-3">
            <h2 class="text-muted">{section.name}</h2>
            <pre class="whitespace-pre-wrap break-all">{section.text}</pre>
          </section>
        )}
      </For>
    </>
  )
}
