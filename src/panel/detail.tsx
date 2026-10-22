import {
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js"
import type { Entry, NameValue } from "../capture/entry"
import { loadBody } from "./body"
import { dataSections } from "./summary"
import { timingRows } from "./timing"

const tabs = ["Summary", "Body", "Headers", "Params/Cookies", "Timing"] as const
type Tab = (typeof tabs)[number]

export function Detail(props: { entry: Entry }) {
  // Kept across selection changes: the Show around Detail is not keyed.
  const [active, setActive] = createSignal<Tab>("Summary")
  const id = (tab: Tab) => tab.toLowerCase().replace(/\W+/g, "-")

  return (
    <section class="flex w-1/2 flex-col border-l border-border">
      <div role="tablist" class="flex border-b border-border">
        <For each={tabs}>
          {(tab) => (
            <button
              type="button"
              role="tab"
              id={`tab-${id(tab)}`}
              aria-selected={active() === tab}
              aria-controls={`panel-${id(tab)}`}
              class="border-b-2 px-2 py-1"
              classList={{
                "border-fg": active() === tab,
                "border-transparent text-muted": active() !== tab,
              }}
              onClick={() => setActive(tab)}
            >
              {tab}
            </button>
          )}
        </For>
      </div>
      <div
        role="tabpanel"
        id={`panel-${id(active())}`}
        aria-labelledby={`tab-${id(active())}`}
        class="flex-1 overflow-auto p-2"
      >
        <Switch>
          <Match when={active() === "Summary"}>
            <Summary entry={props.entry} />
          </Match>
          <Match when={active() === "Body"}>
            <BodyPanel entry={props.entry} />
          </Match>
          <Match when={active() === "Headers"}>
            <Pairs
              title="Request headers"
              pairs={props.entry.exchange.requestHeaders}
              separator=": "
            />
            <Pairs
              title="Response headers"
              pairs={props.entry.exchange.responseHeaders}
              separator=": "
            />
          </Match>
          <Match when={active() === "Params/Cookies"}>
            <Pairs
              title="Query params"
              pairs={props.entry.exchange.queryString}
              separator=" = "
            />
            <Pairs
              title="Request cookies"
              pairs={props.entry.exchange.requestCookies}
              separator=" = "
            />
            <Pairs
              title="Response cookies"
              pairs={props.entry.exchange.responseCookies}
              separator=" = "
            />
          </Match>
          <Match when={active() === "Timing"}>
            <TimingPanel entry={props.entry} />
          </Match>
        </Switch>
      </div>
    </section>
  )
}

function TimingPanel(props: { entry: Entry }) {
  const ms = (n: number) => `${Math.round(n * 10) / 10} ms`
  return (
    <>
      <p class="mb-2">Total {ms(props.entry.time)}</p>
      <div class="grid grid-cols-[max-content_max-content_1fr] items-center gap-x-3 gap-y-0.5">
        <For each={timingRows(props.entry.exchange.timings)}>
          {(row) => (
            <>
              <span class="text-muted">{row.phase}</span>
              <span class="text-right">
                {row.ms === undefined ? "-" : ms(row.ms)}
              </span>
              <div
                class="h-2 bg-selected"
                style={{ width: `${row.fraction * 100}%` }}
              />
            </>
          )}
        </For>
      </div>
    </>
  )
}

function Pairs(props: {
  title: string
  pairs: NameValue[]
  separator: string
}) {
  return (
    <section class="mb-3">
      <h2 class="text-muted">{props.title}</h2>
      <Show when={props.pairs.length} fallback={<p class="text-muted">None</p>}>
        <ul>
          <For each={props.pairs}>
            {(pair) => (
              <li class="break-all">
                {pair.name}
                {props.separator}
                {pair.value}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}

// Rendered only while the Body tab is active, so the body loads on demand.
function BodyPanel(props: { entry: Entry }) {
  const [body] = createResource(
    () => props.entry,
    (entry) => loadBody(entry),
  )
  return (
    <Show when={body()}>
      {(b) => (
        <>
          <For each={b().notes}>
            {(note) => <p class="text-muted">{note}</p>}
          </For>
          <pre class="whitespace-pre-wrap break-all">{b().text}</pre>
        </>
      )}
    </Show>
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
