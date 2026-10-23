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
import { baseMime } from "../decoders/text"
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
import { valueText } from "./copy"
import { CopyButton, createCopied } from "./copy-button"
import { toCurl, toFetch } from "./curl"
import { collapse, diffSections } from "./diff"
import { summaryHeading } from "./heading"
import { hexDump } from "./hex-dump"
import { OPEN_DEPTH, treeValue } from "./json"
import { JsonTree } from "./json-tree"
import { nextTab } from "./keys"
import { byteLabel } from "./messages"
import { Messages } from "./messages.tsx"
import { rawRequest, rawResponse } from "./raw"
import type { Schemas } from "./schemas"
import { Pairs, Section, Sections, Text } from "./section"
import { socketRows } from "./socket"
import { Splitter } from "./splitter.tsx"
import { shownTab, type Tab, tabsFor } from "./tabs"
import { timingRows } from "./timing"
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
    <div class="relative">
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
  // The entry marked with Compare, if any.
  base: Entry | undefined
  onCompare: (id: number | undefined) => void
  // Highlighted in the Body tab; empty unless body search is on.
  bodyQuery: string
  // Set when a body-only match is selected: the tab that shows it.
  openTab?: { tab: Tab }
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
  const comparing = () =>
    props.base && props.base.id !== props.entry.id ? props.base : undefined
  const tabs = () => tabsFor(props.entry, !!comparing())
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
              isBase={props.base?.id === props.entry.id}
              onCompare={props.onCompare}
            />
          </Match>
          <Match when={shown() === "Body"}>
            <LoadedBody entry={props.entry} pretty={true}>
              {(text, body) => (
                <BodyView
                  text={text}
                  view={body.view}
                  entry={props.entry}
                  query={props.bodyQuery}
                />
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
            <RawPanel entry={props.entry} query={props.bodyQuery} />
          </Match>
          <Match when={shown() === "Diff" && comparing()}>
            {(base) => <DiffView base={base()} entry={props.entry} />}
          </Match>
        </Switch>
      </div>
    </section>
  )
}

// The whole tab waits for the body, so Copy can take request and response together.
function RawPanel(props: { entry: Entry; query: string }) {
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
              <Text query={props.query}>{request}</Text>
            </Section>
            <Section title="Response">
              <Text query={props.query}>{response}</Text>
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
}) {
  const json = () => treeValue(props.text)
  const [allOpen, setAllOpen] = createSignal(false)
  let view!: HTMLDivElement
  createEffect(
    on([() => props.query, () => props.text], () =>
      view.querySelector("mark")?.scrollIntoView({ block: "center" }),
    ),
  )
  return (
    <div ref={view} class="contents">
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
  return <div class="flex justify-end gap-1">{props.children}</div>
}

// Both bodies load only once the tab is shown, like every other body.
function DiffView(props: { base: Entry; entry: Entry }) {
  const [bodies] = createResource(
    () => [props.base, props.entry] as const,
    ([base, entry]) =>
      Promise.all([
        loadBody(base, { pretty: false }),
        loadBody(entry, { pretty: false }),
      ]),
  )
  const heading = () => summaryHeading(props.base)
  return (
    <>
      <p class="text-muted">
        Base: <span class="font-mono">{heading().title}</span> ·{" "}
        <span class="font-mono">
          {heading().method} {heading().path}
        </span>
      </p>
      <Show when={bodies()}>
        {(loaded) => (
          <For
            each={diffSections(
              props.base,
              props.entry,
              loaded()[0].text,
              loaded()[1].text,
            )}
          >
            {(section) => (
              <section data-diff={section.name} class="flex flex-col gap-1.5">
                <div class="flex items-baseline gap-1.5">
                  <h2 class="font-semibold text-muted">{section.name}</h2>
                  <Show when={!section.changed}>
                    <span class="text-muted">unchanged</span>
                  </Show>
                </div>
                <Show when={section.changed}>
                  <pre class="overflow-x-auto rounded-md bg-surface p-2 font-mono">
                    <For each={collapse(section.lines)}>
                      {(line) => (
                        <div
                          classList={{
                            "text-success": line.op === "+",
                            "text-error": line.op === "-",
                          }}
                        >
                          {`${line.op} ${line.text}`}
                        </div>
                      )}
                    </For>
                  </pre>
                </Show>
              </section>
            )}
          </For>
        )}
      </Show>
    </>
  )
}

function Summary(props: {
  entry: Entry
  schemas: Schemas
  isBase: boolean
  onCompare: (id: number | undefined) => void
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
          <div class="ml-auto flex shrink-0 items-center gap-1 self-center font-sans">
            <button
              type="button"
              data-compare
              aria-pressed={props.isBase}
              class="rounded px-1.5 py-0.5 hover:bg-selected hover:text-fg"
              classList={{
                "text-accent": props.isBase,
                "text-muted": !props.isBase,
              }}
              onClick={() =>
                props.onCompare(props.isBase ? undefined : props.entry.id)
              }
            >
              Compare
            </button>
            <Show when={!props.entry.socket}>
              <CopyAs entry={props.entry} />
            </Show>
          </div>
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
