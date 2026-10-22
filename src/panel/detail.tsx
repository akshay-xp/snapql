import {
  createResource,
  createSignal,
  For,
  type JSX,
  Match,
  Show,
  Switch,
} from "solid-js"
import type { Entry, NameValue } from "../capture/entry"
import { decoders } from "../decoders"
import { parseJson } from "../decoders/json"
import { decoderFor } from "../decoders/registry"
import type { DecodedResponse } from "../decoders/types"
import { loadBody } from "./body"
import { pairsText, valueText } from "./copy"
import { CopyButton } from "./copy-button"
import { summaryHeading } from "./heading"
import { OPEN_DEPTH } from "./json"
import { JsonTree } from "./json-tree"
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
                "border-accent": active() === tab,
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
            <LoadedBody entry={props.entry} pretty={true}>
              {(text) => <BodyView text={text} />}
            </LoadedBody>
          </Match>
          <Match when={active() === "Headers"}>
            <Pairs
              title="Request headers"
              pairs={props.entry.exchange.requestHeaders}
              decode
            />
            <Pairs
              title="Response headers"
              pairs={props.entry.exchange.responseHeaders}
              decode
            />
          </Match>
          <Match when={active() === "Params/Cookies"}>
            <Pairs
              title="Query params"
              pairs={props.entry.exchange.queryString}
              decode
            />
            <Pairs
              title="Request cookies"
              pairs={props.entry.exchange.requestCookies}
              decode
            />
            <Pairs
              title="Response cookies"
              pairs={props.entry.exchange.responseCookies}
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
      <LoadedBody entry={props.entry} pretty={false}>
        {(text) => <Text>{rawResponse(props.entry, text)}</Text>}
      </LoadedBody>
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

function Pairs(props: { title: string; pairs: NameValue[]; decode?: boolean }) {
  return (
    <Section title={props.title} copy={() => pairsText(props.pairs)}>
      <Show when={props.pairs.length} fallback={<p class="text-muted">None</p>}>
        <dl
          data-section={props.title}
          class="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5 font-mono"
        >
          <For each={props.pairs}>
            {(pair) => (
              <>
                <dt class="text-syntax-key">{pair.name}</dt>
                <dd class="break-all">
                  <span
                    data-value
                    classList={{ "text-error": props.title === "errors" }}
                  >
                    {pair.value}
                  </span>
                  <Show when={props.decode && decodeValue(pair.value)}>
                    {(decoded) => (
                      <div class="whitespace-pre-wrap text-muted">
                        {decoded()}
                      </div>
                    )}
                  </Show>
                </dd>
              </>
            )}
          </For>
        </dl>
      </Show>
    </Section>
  )
}

// Mounted only while its tab is active, so the body loads on demand.
function LoadedBody(props: {
  entry: Entry
  pretty: boolean
  children: (text: string) => JSX.Element
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
          {props.children(b().text)}
        </>
      )}
    </Show>
  )
}

function Text(props: { children: string }) {
  return (
    <pre class="font-mono whitespace-pre-wrap break-all">{props.children}</pre>
  )
}

function BodyView(props: { text: string }) {
  const json = () => {
    const value = parseJson(props.text)
    return typeof value === "object" && value !== null ? value : undefined
  }
  const [allOpen, setAllOpen] = createSignal(false)
  return (
    <Show when={json()} fallback={<Text>{props.text}</Text>}>
      {(value) => (
        <>
          <div class="flex justify-end">
            <button
              type="button"
              class="rounded px-1.5 text-muted hover:bg-selected hover:text-fg"
              onClick={() => setAllOpen(true)}
            >
              Expand all
            </button>
          </div>
          <JsonTree
            value={value()}
            openDepth={allOpen() ? Number.POSITIVE_INFINITY : OPEN_DEPTH}
          />
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
  const heading = () => summaryHeading(props.entry)

  return (
    <>
      <header class="flex flex-col gap-1">
        <div class="flex items-baseline gap-2">
          <span class="break-all text-[15px] font-semibold">
            {heading().title}
          </span>
          <Show when={heading().tag}>
            <span class="shrink-0 rounded border border-border px-1.5 text-[11px] text-muted">
              {heading().tag}
            </span>
          </Show>
        </div>
        <div class="flex flex-wrap gap-x-1.5 text-muted">
          <span class="font-mono" data-path title={props.entry.url}>
            {heading().method} {heading().path}
          </span>
          <span>·</span>
          <span
            data-status
            classList={{
              "text-success": heading().ok,
              "text-error": !heading().ok,
            }}
          >
            {heading().status}
          </span>
          <span>·</span>
          <span>{heading().time}</span>
          <span>·</span>
          <span>{heading().clock}</span>
        </div>
      </header>
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
        <div class="mt-5">
          <h2 class="font-semibold">
            Response <span class="font-normal text-muted">· {d().summary}</span>
          </h2>
          <Sections data={d().data} />
        </div>
      )}
    </Show>
  )
}

function Tokens(props: { entry: Entry }) {
  const tokens = () => findTokens(props.entry.exchange)
  return (
    <Show when={tokens().length}>
      <For each={tokens()}>
        {(token) => (
          <Section
            title="Tokens"
            copy={() =>
              valueText({
                header: token.jwt.header,
                payload: token.jwt.payload,
              })
            }
          >
            <p>
              {token.source} <span class="text-muted">· unverified</span>
            </p>
            <Show when={token.jwt.expires}>
              {(expires) => <p class="text-muted">expires {expires()}</p>}
            </Show>
            <h3 class="mt-1 text-muted">header</h3>
            <JsonTree value={token.jwt.header} />
            <h3 class="mt-1 text-muted">payload</h3>
            <JsonTree value={token.jwt.payload} />
          </Section>
        )}
      </For>
    </Show>
  )
}

function Section(props: {
  title: string
  copy?: () => string
  children: JSX.Element
}) {
  return (
    <section class="mt-4 flex flex-col gap-1.5">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-muted">{props.title}</h2>
        <Show when={props.copy}>
          {(copy) => <CopyButton label={`Copy ${props.title}`} text={copy()} />}
        </Show>
      </div>
      <div data-block class="rounded-md bg-surface px-3 py-2">
        {props.children}
      </div>
    </section>
  )
}

function Sections(props: { data: unknown }) {
  return (
    <For each={dataSections(props.data)}>
      {(section) =>
        "rows" in section ? (
          <Pairs title={section.name} pairs={section.rows} />
        ) : (
          <Section
            title={section.name}
            copy={() =>
              valueText("text" in section ? section.text : section.json)
            }
          >
            {"text" in section ? (
              <Text>{section.text}</Text>
            ) : (
              <JsonTree value={section.json} />
            )}
          </Section>
        )
      }
    </For>
  )
}
