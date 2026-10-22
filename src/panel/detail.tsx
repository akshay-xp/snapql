import {
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js"
import type { Entry, NameValue } from "../capture/entry"
import { decoders } from "../decoders"
import { decoderFor } from "../decoders/registry"
import type { DecodedResponse } from "../decoders/types"
import { loadBody } from "./body"
import { nextTab } from "./keys"
import { rawRequest, rawResponse } from "./raw"
import { Splitter } from "./splitter.tsx"
import { dataSections } from "./summary"
import { timingRows } from "./timing"
import { decodeValue, findTokens } from "./values"

const tabs = [
  "Summary",
  "Body",
  "Headers",
  "Params/Cookies",
  "Timing",
  "Raw",
] as const
type Tab = (typeof tabs)[number]

export function Detail(props: {
  entry: Entry
  width: number | undefined
  onResize: (clientX: number) => void
}) {
  // Kept across selection changes: the Show around Detail is not keyed.
  const [active, setActive] = createSignal<Tab>("Summary")
  const id = (tab: Tab) => tab.toLowerCase().replace(/\W+/g, "-")
  const onTabKey = (e: KeyboardEvent) => {
    const i = nextTab(e.key, tabs.indexOf(active()), tabs.length)
    if (i === undefined) return
    e.preventDefault()
    setActive(tabs[i])
    document.getElementById(`tab-${id(tabs[i])}`)?.focus()
  }

  return (
    <section
      class="relative flex shrink-0 flex-col border-l border-border"
      classList={{ "w-1/2": props.width === undefined }}
      style={{
        width: props.width === undefined ? undefined : `${props.width}px`,
      }}
    >
      <Splitter onDrag={props.onResize} />
      <div
        role="tablist"
        class="flex border-b border-border"
        onKeyDown={onTabKey}
      >
        <For each={tabs}>
          {(tab) => (
            <button
              type="button"
              role="tab"
              id={`tab-${id(tab)}`}
              aria-selected={active() === tab}
              aria-controls={`panel-${id(tab)}`}
              tabIndex={active() === tab ? 0 : -1}
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
            <LoadedBody
              entry={props.entry}
              pretty={true}
              render={(text) => text}
            />
          </Match>
          <Match when={active() === "Headers"}>
            <Pairs
              title="Request headers"
              pairs={props.entry.exchange.requestHeaders}
              separator=": "
              decode
            />
            <Pairs
              title="Response headers"
              pairs={props.entry.exchange.responseHeaders}
              separator=": "
              decode
            />
          </Match>
          <Match when={active() === "Params/Cookies"}>
            <Pairs
              title="Query params"
              pairs={props.entry.exchange.queryString}
              separator=" = "
              decode
            />
            <Pairs
              title="Request cookies"
              pairs={props.entry.exchange.requestCookies}
              separator=" = "
              decode
            />
            <Pairs
              title="Response cookies"
              pairs={props.entry.exchange.responseCookies}
              separator=" = "
              decode
            />
          </Match>
          <Match when={active() === "Timing"}>
            <TimingPanel entry={props.entry} />
          </Match>
          <Match when={active() === "Raw"}>
            <RawPanel entry={props.entry} />
          </Match>
        </Switch>
      </div>
    </section>
  )
}

function RawPanel(props: { entry: Entry }) {
  return (
    <>
      <h2 class="text-muted">Request</h2>
      <pre class="font-mono mb-3 whitespace-pre-wrap break-all">
        {rawRequest(props.entry)}
      </pre>
      <h2 class="text-muted">Response</h2>
      <LoadedBody
        entry={props.entry}
        pretty={false}
        render={(text) => rawResponse(props.entry, text)}
      />
    </>
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
  decode?: boolean
}) {
  return (
    <section class="mb-3">
      <h2 class="text-muted">{props.title}</h2>
      <Show when={props.pairs.length} fallback={<p class="text-muted">None</p>}>
        <ul class="font-mono">
          <For each={props.pairs}>
            {(pair) => (
              <li class="break-all">
                {pair.name}
                {props.separator}
                {pair.value}
                <Show when={props.decode && decodeValue(pair.value)}>
                  {(decoded) => (
                    <div class="whitespace-pre-wrap text-muted">
                      {decoded()}
                    </div>
                  )}
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}

// Mounted only while its tab is active, so the body loads on demand.
function LoadedBody(props: {
  entry: Entry
  pretty: boolean
  render: (text: string) => string
}) {
  const [body] = createResource(
    () => props.entry,
    (entry) => loadBody(entry, { pretty: props.pretty }),
  )
  return (
    <Show when={body()}>
      {(b) => (
        <>
          <For each={b().notes}>
            {(note) => <p class="text-muted">{note}</p>}
          </For>
          <pre class="font-mono whitespace-pre-wrap break-all">
            {props.render(b().text)}
          </pre>
        </>
      )}
    </Show>
  )
}

function Summary(props: { entry: Entry }) {
  const decodeResponse = () => {
    const decoded = props.entry.decoded
    if (!decoded) return
    const decode = decoderFor(decoded.kind, decoders)?.decodeResponse
    return decode && ((text: string) => decode(text, decoded))
  }
  const fields = () => {
    const e = props.entry
    return [
      ["Method", e.method],
      ["URL", e.url],
      ["Status", String(e.status)],
      ["Kind", e.decoded?.kind],
      ["Title", e.decoded?.title],
      ["Detail", e.decoded?.detail],
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
              <dd class="break-all font-mono">{value}</dd>
            </>
          )}
        </For>
      </dl>
      <Sections data={props.entry.decoded?.data} />
      <Tokens entry={props.entry} />
      <Show when={decodeResponse()}>
        {(decode) => <ResponseGroup entry={props.entry} decode={decode()} />}
      </Show>
    </>
  )
}

// Mounted only while Summary is shown, so the response body loads on demand.
function ResponseGroup(props: {
  entry: Entry
  decode: (text: string) => DecodedResponse | undefined
}) {
  const [body] = createResource(
    () => props.entry,
    (entry) => loadBody(entry, { pretty: false }),
  )
  const decoded = () => {
    const b = body()
    return b && props.decode(b.text)
  }
  return (
    <Show when={decoded()}>
      {(d) => (
        <section class="mt-3">
          <h2 class="font-bold">Response</h2>
          <p>{d().summary}</p>
          <Sections data={d().data} />
        </section>
      )}
    </Show>
  )
}

function Tokens(props: { entry: Entry }) {
  const tokens = () => findTokens(props.entry.exchange)
  const json = (value: unknown) => JSON.stringify(value, null, 2)
  return (
    <Show when={tokens().length}>
      <section class="mt-3">
        <h2 class="font-bold">Tokens</h2>
        <For each={tokens()}>
          {(token) => (
            <div class="mt-2">
              <p>{token.source} · unverified</p>
              <Show when={token.jwt.expires}>
                {(expires) => <p class="text-muted">expires {expires()}</p>}
              </Show>
              <h3 class="text-muted">header</h3>
              <pre class="font-mono whitespace-pre-wrap break-all">
                {json(token.jwt.header)}
              </pre>
              <h3 class="text-muted">payload</h3>
              <pre class="font-mono whitespace-pre-wrap break-all">
                {json(token.jwt.payload)}
              </pre>
            </div>
          )}
        </For>
      </section>
    </Show>
  )
}

function Sections(props: { data: unknown }) {
  return (
    <For each={dataSections(props.data)}>
      {(section) =>
        "rows" in section ? (
          <div class="mt-3">
            <Pairs title={section.name} pairs={section.rows} separator=" = " />
          </div>
        ) : (
          <section class="mt-3">
            <h2 class="text-muted">{section.name}</h2>
            <pre class="font-mono whitespace-pre-wrap break-all">
              {section.text}
            </pre>
          </section>
        )
      }
    </For>
  )
}
