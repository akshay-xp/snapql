import {
  createEffect,
  createResource,
  createSignal,
  For,
  type JSX,
  Match,
  on,
  Show,
  Switch,
} from "solid-js"
import { type Body, type Entry, incoming, type Message } from "../capture/entry"
import { decoders } from "../decoders"
import { bytes } from "../decoders/bytes"
import { grpcRequestData, grpcResponse } from "../decoders/grpc-web"
import { decoderFor } from "../decoders/registry"
import { parseStream } from "../decoders/stream"
import { baseMime, count } from "../decoders/text"
import type { DecodedResponse } from "../decoders/types"
import {
  type BinaryFormat,
  binaryFormat,
  decodeBinaryFrame,
} from "./binary-frames"
import {
  BODY_LIMIT,
  type BodyViewKind,
  type FormattedBody,
  imageSrc,
  loadBody,
} from "./body"
import { Clipped } from "./clipped"
import { valueText } from "./copy"
import { CopyButton, createCopied } from "./copy-button"
import { toCurl, toFetch } from "./curl"
import { summaryHeading } from "./heading"
import { hexDump } from "./hex-dump"
import { OPEN_DEPTH, treeValue } from "./json"
import { JsonTree } from "./json-tree"
import { nextTab } from "./keys"
import { createMatches, MatchNav, type Step } from "./matches"
import { byteLabel } from "./messages"
import { Messages } from "./messages.tsx"
import { rawRequest, rawResponse } from "./raw"
import type { Schemas } from "./schemas"
import { Pairs, Section, Sections, Text } from "./section"
import { socketRows } from "./socket"
import { Splitter } from "./splitter.tsx"
import { shownTab, type Tab, tabsFor } from "./tabs"
import { type Stage, timingView } from "./timing"
import { findTokens } from "./values"

// Binary frames decode by format; text frames by the entry's own decoder,
// which sees the whole frame list.
function CopyAs(props: { entry: Entry }) {
  const [open, setOpen] = createSignal(false)
  const [copied, copy] = createCopied()
  const item = (label: string, text: (entry: Entry) => string) => (
    <button
      type="button"
      role="menuitem"
      class="rounded px-2 py-1 text-left hover:bg-selected"
      onClick={() => {
        copy(text(props.entry))
        setOpen(false)
      }}
    >
      {label}
    </button>
  )
  return (
    <div class="relative ml-auto shrink-0 self-center font-sans">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open()}
        class="rounded px-1.5 py-0.5 text-muted hover:bg-selected hover:text-fg"
        onClick={() => setOpen(!open())}
      >
        {copied() ? "Copied" : "Copy as"}
      </button>
      <Show when={open()}>
        <div
          role="menu"
          class="absolute top-full right-0 z-10 mt-1 flex w-28 flex-col rounded-md border border-border bg-bg p-1 shadow-lg"
        >
          {item("cURL", toCurl)}
          {item("fetch", toFetch)}
        </div>
      </Show>
    </div>
  )
}

function frameDecoder(entry: Entry, format: BinaryFormat) {
  const kind = entry.decoded?.kind
  const decode = kind ? decoderFor(kind, decoders)?.decodeMessage : undefined
  return (m: Message) =>
    m.base64 !== undefined
      ? decodeBinaryFrame({ ...m, base64: m.base64 }, format)
      : decode?.(m, entry.messages ?? [])
}

const FORMATS: [BinaryFormat, string][] = [
  ["hex", "Hex"],
  ["msgpack", "msgpack"],
  ["cbor", "CBOR"],
  ["protobuf", "protobuf"],
]

export function Detail(props: {
  entry: Entry
  schemas: Schemas
  stacked: boolean
  // Width side by side, height stacked; undefined means half the panel.
  size: number | undefined
  onResize: (clientX: number, clientY: number) => void
  // Highlighted in the Body tab; empty unless body search is on.
  bodyQuery: string
  // Set when a body-only match is selected: the tab that shows it.
  openTab?: { tab: Tab }
  // Enter in the search box: a fresh object per press.
  stepMatch?: Step
}) {
  // Kept across selection changes: the Show around Detail is not keyed.
  const [active, setActive] = createSignal<Tab>("Summary")
  createEffect(
    on(
      () => props.openTab,
      (open) => open && setActive(open.tab),
    ),
  )
  // Decode as choices by entry id, while the panel is open.
  const [formats, setFormats] = createSignal<Record<number, BinaryFormat>>({})
  const format = () => {
    const socket = props.entry.socket
    return (
      formats()[props.entry.id] ??
      binaryFormat([socket?.protocol ?? "", ...(socket?.protocols ?? [])])
    )
  }
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
            <Summary
              entry={props.entry}
              schemas={props.schemas}
              onParams={
                tabs().includes("Params/Cookies")
                  ? () => setActive("Params/Cookies")
                  : undefined
              }
            />
          </Match>
          <Match when={shown() === "Body"}>
            <LoadedBody entry={props.entry} pretty={true}>
              {(text, body) => (
                <Show
                  when={text || body.notes.length}
                  fallback={<p class="text-muted">No response body</p>}
                >
                  <BodyView
                    text={text}
                    view={body.view}
                    entry={props.entry}
                    query={props.bodyQuery}
                    step={props.stepMatch}
                  />
                </Show>
              )}
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
                  <>
                    <Show when={messages().some((m) => m.base64 !== undefined)}>
                      <label class="flex items-center gap-1.5 text-muted">
                        Decode as
                        <select
                          aria-label="Decode as"
                          class="rounded border border-border bg-bg px-1 py-0.5 text-fg"
                          value={format()}
                          onChange={(e) =>
                            setFormats({
                              ...formats(),
                              [props.entry.id]: e.currentTarget
                                .value as BinaryFormat,
                            })
                          }
                        >
                          <For each={FORMATS}>
                            {([value, label]) => (
                              <option value={value}>{label}</option>
                            )}
                          </For>
                        </select>
                      </label>
                    </Show>
                    <Messages
                      messages={messages()}
                      timed
                      directions={!!props.entry.socket}
                      decode={frameDecoder(props.entry, format())}
                    />
                  </>
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
            <RawPanel
              entry={props.entry}
              query={props.bodyQuery}
              step={props.stepMatch}
            />
          </Match>
        </Switch>
      </div>
    </section>
  )
}

// The whole tab waits for the body, so Copy can take request and response together.
function RawPanel(props: { entry: Entry; query: string; step?: Step }) {
  return (
    <LoadedBody entry={props.entry} pretty={false}>
      {(text) => (
        <RawView
          request={rawRequest(props.entry)}
          response={rawResponse(props.entry, text)}
          query={props.query}
          step={props.step}
        />
      )}
    </LoadedBody>
  )
}

function RawView(props: {
  request: string
  response: string
  query: string
  step?: Step
}) {
  let view!: HTMLDivElement
  const matches = createMatches(
    () => view,
    () => [props.query, props.request, props.response],
    () => props.step,
  )
  return (
    <div ref={view} class="contents">
      <Toolbar>
        <MatchNav
          index={matches.index()}
          count={matches.count()}
          onMove={matches.move}
        />
        <CopyButton
          label="Copy"
          captioned
          value={() => `${props.request}\n\n${props.response}`}
        />
      </Toolbar>
      <Section title="Request">
        <Text query={props.query}>{props.request}</Text>
      </Section>
      <Section title="Response">
        <Text query={props.query}>{props.response}</Text>
      </Section>
    </div>
  )
}

const stage: Record<Stage, { label: string; color: string; border: string }> = {
  setup: { label: "Setup", color: "bg-muted", border: "border-muted" },
  server: { label: "Server", color: "bg-accent", border: "border-accent" },
  download: {
    label: "Download",
    color: "bg-success",
    border: "border-success",
  },
}

function TimingPanel(props: { entry: Entry }) {
  const ms = (n: number) => `${Math.round(n * 10) / 10} ms`
  const percent = (n: number) => `${n * 100}%`
  const view = () => timingView(props.entry.exchange.timings)
  return (
    <>
      <p class="flex items-baseline gap-2">
        <span class="text-muted">Total</span>
        <span data-total class="font-mono text-xl font-semibold">
          {ms(props.entry.time)}
        </span>
      </p>
      <div data-stages class="flex flex-wrap gap-2">
        <For each={view().stages}>
          {(s) => (
            <div
              data-stage
              data-top={s.stage === view().top ? "" : undefined}
              class={`flex min-w-28 flex-1 flex-col gap-0.5 rounded-md border bg-surface px-3 py-2 ${
                s.stage === view().top
                  ? stage[s.stage].border
                  : "border-transparent"
              }`}
            >
              <span class="flex items-center gap-1.5 text-muted">
                <span class={`size-2 rounded-full ${stage[s.stage].color}`} />
                {stage[s.stage].label}
              </span>
              <span class="font-mono">
                {ms(s.ms)}{" "}
                <span class="text-muted">{Math.round(s.fraction * 100)}%</span>
              </span>
            </div>
          )}
        </For>
      </div>
      <Section title="Phases">
        <div class="grid grid-cols-[max-content_max-content_1fr] items-center gap-x-3 gap-y-1">
          <For each={view().rows}>
            {(row) => (
              <>
                <span data-phase>
                  {row.label}
                  <Show when={row.phase === "connect" && view().tls}>
                    {(tls) => (
                      <span class="text-muted"> incl. TLS {ms(tls())}</span>
                    )}
                  </Show>
                </span>
                <span data-ms class="text-right font-mono text-muted">
                  {ms(row.ms)}
                </span>
                <div class="h-2 overflow-hidden">
                  <div
                    data-bar
                    class={`h-full min-w-px ${stage[row.stage].color}`}
                    style={{
                      "margin-left": percent(row.offset),
                      width: percent(row.fraction),
                    }}
                  />
                </div>
              </>
            )}
          </For>
        </div>
        <Show when={view().reused}>
          <p class="mt-2 text-muted">Reused connection: no DNS or connect</p>
        </Show>
      </Section>
    </>
  )
}

// Mounted only while its tab is active, so the body loads on demand.
function LoadedBody(props: {
  entry: Entry
  pretty: boolean
  children: (text: string, body: FormattedBody) => JSX.Element
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
          {props.children(b().text, b())}
        </>
      )}
    </Show>
  )
}

function BodyView(props: {
  text: string
  view?: BodyViewKind
  entry: Entry
  query: string
  step?: Step
}) {
  const json = () => treeValue(props.text)
  const [allOpen, setAllOpen] = createSignal(false)
  let view!: HTMLDivElement
  const matches = createMatches(
    () => view,
    () => [props.query, props.text],
    () => props.step,
  )
  return (
    <div ref={view} class="contents">
      <Toolbar>
        <MatchNav
          index={matches.index()}
          count={matches.count()}
          onMove={matches.move}
        />
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
      <Switch
        fallback={
          <Show
            when={json()}
            fallback={<Text query={props.query}>{props.text}</Text>}
          >
            {(value) => (
              <JsonTree
                value={value()}
                openDepth={allOpen() ? Number.POSITIVE_INFINITY : OPEN_DEPTH}
                query={props.query}
              />
            )}
          </Show>
        }
      >
        <Match when={props.view === "image"}>
          <ImagePreview text={props.text} mimeType={props.entry.mimeType} />
        </Match>
        <Match when={props.view === "font"}>
          <FontPreview text={props.text} id={props.entry.id} />
        </Match>
        <Match when={props.view === "hex"}>
          <Text>{hexDump(fromBase64(props.text))}</Text>
        </Match>
      </Switch>
    </div>
  )
}

const fromBase64 = (content: string) => bytes({ content, encoding: "base64" })

function ImagePreview(props: { text: string; mimeType: string }) {
  const svg = () => baseMime(props.mimeType) === "image/svg+xml"
  const size = () =>
    svg()
      ? new TextEncoder().encode(props.text).length
      : fromBase64(props.text).length
  const [shown, setShown] = createSignal<string>()
  return (
    <>
      <img
        src={imageSrc(props.text, props.mimeType)}
        alt=""
        class="max-w-full self-start"
        onLoad={(e) =>
          setShown(
            `${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight} px · ${byteLabel(size())}`,
          )
        }
        onError={() => setShown("image failed to load")}
      />
      <Show when={shown()}>
        {(caption) => <p class="text-muted">{caption()}</p>}
      </Show>
      <Show when={svg()}>
        <Text>{props.text}</Text>
      </Show>
    </>
  )
}

const FONT_SAMPLE = "The quick brown fox jumps over the lazy dog 0123456789"

// Loaded under a per-entry family name so previews never clash.
function FontPreview(props: { text: string; id: number }) {
  const family = () => `snapql-font-${props.id}`
  const [loaded] = createResource(
    () => props.text,
    async (text) => {
      try {
        const face = new FontFace(family(), fromBase64(text))
        document.fonts.add(await face.load())
        return true
      } catch {
        return false
      }
    },
  )
  return (
    <Show when={loaded() !== undefined}>
      <Show
        when={loaded()}
        fallback={<p class="text-error">font failed to load</p>}
      >
        <For each={[12, 18, 28]}>
          {(px) => (
            <p
              style={{ "font-family": `"${family()}"`, "font-size": `${px}px` }}
            >
              {FONT_SAMPLE}
            </p>
          )}
        </For>
      </Show>
    </Show>
  )
}

// Tab-level actions live in the panel: the tab bar can't know a lazily loaded body.
function Toolbar(props: { children: JSX.Element }) {
  // Sticky, so Copy and match stepping stay in reach in long bodies; -top-3
  // cancels the tabpanel padding, so nothing shows through above it.
  return (
    <div class="sticky -top-3 z-10 -mx-3 flex justify-end gap-1 bg-bg px-3 py-1">
      {props.children}
    </div>
  )
}

function Summary(props: {
  entry: Entry
  schemas: Schemas
  // Absent when the entry has no Params tab (sockets).
  onParams?: () => void
}) {
  const readers = useSchemaReaders(props)
  const requestData = () => {
    const r = readers()
    const body = props.entry.requestBody
    return r && body
      ? grpcRequestData(body.mimeType, body.text, r.input)
      : props.entry.decoded?.data
  }
  const decodeResponse = () => {
    const decoded = props.entry.decoded
    if (!decoded) return
    const headers = props.entry.exchange.responseHeaders
    const r = readers()
    if (r) return (body: Body) => grpcResponse(body, headers, r.output)
    const decode = decoderFor(decoded.kind, decoders)?.decodeResponse
    return decode && ((body: Body) => decode(body, decoded, headers))
  }
  const heading = () => summaryHeading(props.entry)
  const facts = () => {
    const { method, time, size, cache, clock } = heading()
    return [method, time, size, cache, clock].filter(Boolean)
  }

  return (
    <>
      <header class="flex flex-col gap-1 font-mono">
        {/* Not items-baseline: clipped text's baseline is its bottom edge. */}
        <div class="flex items-center gap-2">
          <Clipped
            parts={heading().titleParts}
            title={heading().title}
            class="text-[15px] font-semibold"
          />
          <Show when={heading().tag}>
            <span
              class="min-w-0 max-w-1/2 shrink-0 truncate rounded border border-border px-1.5 text-[11px] text-muted"
              title={heading().tag}
            >
              {heading().tag}
            </span>
          </Show>
          <Show when={!props.entry.socket}>
            <CopyAs entry={props.entry} />
          </Show>
        </div>
        <div class="flex flex-wrap gap-x-1.5 text-muted">
          <span
            data-status
            classList={{
              "text-success": heading().ok,
              "text-error": !heading().ok,
            }}
          >
            {heading().status}
          </span>
          <For each={facts()}>
            {(fact) => (
              <>
                <span>·</span>
                <span>{fact}</span>
              </>
            )}
          </For>
        </div>
        <div data-url class="flex h-6 items-center gap-1.5 text-muted">
          <Clipped parts={heading().url} title={props.entry.url} />
          <Show when={props.onParams && heading().params}>
            {(n) => (
              <button
                type="button"
                class="shrink-0 text-accent hover:underline"
                onClick={() => props.onParams?.()}
              >
                ?{count(n(), "param")}
              </button>
            )}
          </Show>
          <CopyButton label="Copy URL" value={() => props.entry.url} />
        </div>
      </header>
      <Show when={props.entry.socket}>
        <Pairs title="Socket" pairs={socketRows(props.entry)} />
      </Show>
      <Sections data={requestData()} />
      <Tokens entry={props.entry} />
      <Show when={decodeResponse()}>
        {(decode) => <ResponseGroup entry={props.entry} decode={decode()} />}
      </Show>
    </>
  )
}

// gRPC-web methods found in the loaded schemas decode with field names. The
// parser chunk loads only here and in the picker.
function useSchemaReaders(props: { entry: Entry; schemas: Schemas }) {
  const method = () =>
    props.entry.decoded?.kind === "grpc-web"
      ? props.schemas.schema().methods[new URL(props.entry.url).pathname]
      : undefined
  const [readers] = createResource(method, async (m) => {
    const { messageReader } = await import("../decoders/proto-schema")
    const schema = props.schemas.schema()
    return {
      input: messageReader(schema, m.input),
      output: messageReader(schema, m.output),
    }
  })
  // A resource keeps its last value when its source goes away.
  return () => (method() ? readers() : undefined)
}

// Mounted only while Summary is shown, so the response body loads on demand.
function ResponseGroup(props: {
  entry: Entry
  decode: (body: Body) => DecodedResponse | undefined
}) {
  const [body] = createResource(
    () => props.entry,
    (entry) => entry.getBody().catch(() => undefined),
  )
  const decoded = () => {
    const b = body()
    return b && b.content.length <= BODY_LIMIT ? props.decode(b) : undefined
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
