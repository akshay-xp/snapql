import {
  createResource,
  createSignal,
  For,
  type JSX,
  Match,
  Show,
  Switch,
} from "solid-js"
import { type Entry, incoming, type NameValue } from "../capture/entry"
import { decoders } from "../decoders"
import { decoderFor } from "../decoders/registry"
import { parseStream } from "../decoders/stream"
import type { DecodedResponse } from "../decoders/types"
import { loadBody } from "./body"
import { pairsText, valueText } from "./copy"
import { CopyButton } from "./copy-button"
import { summaryHeading } from "./heading"
import { OPEN_DEPTH, treeValue } from "./json"
import { JsonTree } from "./json-tree"
import { nextTab } from "./keys"
import { Messages } from "./messages.tsx"
import { rawRequest, rawResponse } from "./raw"
import { Section, Text } from "./section"
import { socketRows } from "./socket"
import { Splitter } from "./splitter.tsx"
import { dataSections } from "./summary"
import { shownTab, type Tab, tabsFor } from "./tabs"
import { timingRows } from "./timing"
import { decodeValue, findTokens } from "./values"

export function Detail(props: {
  entry: Entry
  stacked: boolean
  // Width side by side, height stacked; undefined means half the panel.
  size: number | undefined
  onResize: (clientX: number, clientY: number) => void
}) {
  // Kept across selection changes: the Show around Detail is not keyed.
  const [active, setActive] = createSignal<Tab>("Summary")
  const tabs = () => tabsFor(props.entry)
  const shown = () => shownTab(active(), tabs())
  const id = (tab: Tab) => tab.toLowerCase().replace(/\W+/g, "-")
  const onTabKey = (e: KeyboardEvent) => {
    const i = nextTab(e.key, tabs().indexOf(shown()), tabs().length)
    if (i === undefined) return
    e.preventDefault()
    setActive(tabs()[i])
    document.getElementById(`tab-${id(tabs()[i])}`)?.focus()
  }

  return (
    <section
      class="relative flex min-h-0 min-w-0 shrink-0 flex-col border-border"
      classList={{
        "border-t": props.stacked,
        "border-l": !props.stacked,
        "h-1/2": props.stacked && props.size === undefined,
        "w-1/2": !props.stacked && props.size === undefined,
      }}
      style={{
        [props.stacked ? "height" : "width"]:
          props.size === undefined ? undefined : `${props.size}px`,
      }}
    >
      <Splitter stacked={props.stacked} onDrag={props.onResize} />
      <div
        role="tablist"
        class="flex h-10 shrink-0 overflow-x-auto border-b border-border px-1"
        onKeyDown={onTabKey}
      >
        <For each={tabs()}>
          {(tab) => (
            <button
              type="button"
              role="tab"
              id={`tab-${id(tab)}`}
              aria-selected={shown() === tab}
              aria-controls={`panel-${id(tab)}`}
              tabIndex={shown() === tab ? 0 : -1}
              class="shrink-0 border-b-2 px-2.5"
              classList={{
                "border-accent": shown() === tab,
                "border-transparent text-muted": shown() !== tab,
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
        id={`panel-${id(shown())}`}
        aria-labelledby={`tab-${id(shown())}`}
        class="flex flex-1 flex-col gap-4 overflow-auto p-3"
      >
        <Switch>
          <Match when={shown() === "Summary"}>
            <Summary entry={props.entry} />
          </Match>
          <Match when={shown() === "Body"}>
            <LoadedBody entry={props.entry} pretty={true}>
              {(text) => <BodyView text={text} />}
            </LoadedBody>
          </Match>
          <Match when={shown() === "Messages"}>
            {/* Keyed: live entries replace their messages on every update, so
                selection resets only when another entry is shown. */}
            <Show when={props.entry.id} keyed>
              <Show
                when={props.entry.messages}
                fallback={
                  <LoadedBody entry={props.entry} pretty={false}>
                    {(text) => (
                      <Messages
                        messages={incoming(
                          parseStream(props.entry.mimeType, text) ?? [],
                          props.entry.startedAt,
                        )}
                        timed={false}
                      />
                    )}
                  </LoadedBody>
                }
              >
                {(messages) => (
                  <Messages
                    messages={messages()}
                    timed
                    directions={!!props.entry.socket}
                  />
                )}
              </Show>
            </Show>
          </Match>
          <Match when={shown() === "Headers"}>
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
          <Match when={shown() === "Params/Cookies"}>
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
          <Match when={shown() === "Timing"}>
            <TimingPanel entry={props.entry} />
          </Match>
          <Match when={shown() === "Raw"}>
            <RawPanel entry={props.entry} />
          </Match>
        </Switch>
      </div>
    </section>
  )
}

// The whole tab waits for the body, so Copy can take request and response together.
function RawPanel(props: { entry: Entry }) {
  return (
    <LoadedBody entry={props.entry} pretty={false}>
      {(text) => {
        const request = rawRequest(props.entry)
        const response = rawResponse(props.entry, text)
        return (
          <>
            <Toolbar>
              <CopyButton
                label="Copy"
                captioned
                value={() => `${request}\n\n${response}`}
              />
            </Toolbar>
            <Section title="Request">
              <Text>{request}</Text>
            </Section>
            <Section title="Response">
              <Text>{response}</Text>
            </Section>
          </>
        )
      }}
    </LoadedBody>
  )
}

function TimingPanel(props: { entry: Entry }) {
  const ms = (n: number) => `${Math.round(n * 10) / 10} ms`
  return (
    <>
      <p>
        Total <span class="font-mono">{ms(props.entry.time)}</span>
      </p>
      <div class="grid grid-cols-[max-content_max-content_1fr] items-center gap-x-3 gap-y-0.5">
        <For each={timingRows(props.entry.exchange.timings)}>
          {(row) => (
            <>
              <span data-phase class="text-muted">
                {row.phase}
              </span>
              <span data-ms class="text-right font-mono">
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
          class="grid grid-cols-[fit-content(40%)_minmax(0,1fr)] gap-x-4 gap-y-0.5 font-mono"
        >
          <For each={props.pairs}>
            {(pair) => (
              <>
                <dt class="text-syntax-key [overflow-wrap:anywhere]">
                  {pair.name}
                </dt>
                <dd class="[overflow-wrap:anywhere]">
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

function BodyView(props: { text: string }) {
  const json = () => treeValue(props.text)
  const [allOpen, setAllOpen] = createSignal(false)
  return (
    <>
      <Toolbar>
        <Show when={json()}>
          <button
            type="button"
            class="rounded px-1.5 text-muted hover:bg-selected hover:text-fg"
            onClick={() => setAllOpen(true)}
          >
            Expand all
          </button>
        </Show>
        <CopyButton label="Copy" captioned value={() => props.text} />
      </Toolbar>
      <Show when={json()} fallback={<Text>{props.text}</Text>}>
        {(value) => (
          <JsonTree
            value={value()}
            openDepth={allOpen() ? Number.POSITIVE_INFINITY : OPEN_DEPTH}
          />
        )}
      </Show>
    </>
  )
}

// Tab-level actions live in the panel: the tab bar can't know a lazily loaded body.
function Toolbar(props: { children: JSX.Element }) {
  return <div class="flex justify-end gap-1">{props.children}</div>
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
      <header class="flex flex-col gap-1 font-mono">
        <div class="flex items-baseline gap-2">
          <span class="text-[15px] font-semibold [overflow-wrap:anywhere]">
            {heading().title}
          </span>
          <Show when={heading().tag}>
            <span class="shrink-0 rounded border border-border px-1.5 text-[11px] text-muted">
              {heading().tag}
            </span>
          </Show>
        </div>
        <div class="flex flex-wrap gap-x-1.5 text-muted">
          <span data-path title={props.entry.url}>
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
      <Show when={props.entry.socket}>
        <Pairs title="Socket" pairs={socketRows(props.entry)} />
      </Show>
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
        <div class="flex flex-col gap-4">
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
              {(expires) => (
                <p class="text-muted">
                  expires <span class="font-mono">{expires()}</span>
                </p>
              )}
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
