# Capture

Turns finished network requests into `Entry` objects and keeps them in a capped store the UI subscribes to. Plain TypeScript: no UI or browser API imports.

## Types (`src/capture/entry.ts`)

- `FinishedRequest`: input from the browser adapter. `RequestView` (`method`, `url`, `status`, `requestBody?`) plus `mimeType` (response `content.mimeType`, `""` if absent), `startedDateTime` (ISO string), `time` (ms), `fetchBody()`.
- `Entry`: what the store holds. `id`, `method`, `url`, `status`, `startedAt` (epoch ms), `time`, `mimeType`, `decoded?` (`DecodeResult`), `getBody()`.
- `Exchange` (on `FinishedRequest` and `Entry`): what the detail tabs show, mapped once by the adapter from the HAR entry.
  - `requestHeaders`, `responseHeaders`, `queryString`, `requestCookies`, `responseCookies`: `NameValue[]` (`{ name, value }` only; cookie attributes and HAR `comment`s dropped). Missing: `[]`.
  - `httpVersion` (response's; used for request and status lines), `statusText`: missing `""`.
  - `size` (response `content.size`), `timings` (`Timings`: `blocked, dns, connect, ssl, send, wait, receive` ms): missing `-1`, which also means "phase n/a" in HAR.
- `Entry.requestBody`: the request body, kept for the Raw tab (decoders read it from `FinishedRequest` at capture).
- `Body`: `{ content, encoding }`; `encoding` is `""` or `"base64"`, as reported by the browser.
- `Message`: one stream event or socket frame. `dir` (`"in"` | `"out"`), `time` (epoch ms), `text`; optional `bytes` (binary frame size; `text` is `""`), `event`, `id` (SSE fields), `truncated`.
- `Entry.messages?`, `open?` (stream still open), `droppedMessages?` (count evicted by the cap). Absent on ordinary requests.
- `toEntry(req, id, decoded?)`: maps one to the other. Capture owns `FinishedRequest` so this module never references `chrome.*`, not even in types.

## Growing entries

- `appendMessages(entry, msgs)`: returns a copy (same `getBody`) with `msgs` appended. Never mutates.
- `MESSAGE_CAP = 2000` per entry, oldest dropped, added to `droppedMessages`; `FRAME_LIMIT = 1024 * 1024` chars per frame, cut and flagged `truncated`. Why: one chatty socket or huge frame can't exhaust panel memory.

## Lazy bodies

- `getBody()` calls `fetchBody()` on first use and memoizes the promise; concurrent and repeated calls share one fetch.
- Nothing fetches bodies eagerly; listing requests costs no body memory.
- A rejected fetch stays cached; no retry.

## Store (`src/capture/store.ts`)

- `createStore(cap = DEFAULT_CAP)`; `DEFAULT_CAP = 5000`.
- `add(entry)`: appends; drops oldest beyond `cap`.
- `update(id, fn)`: replaces that entry with `fn(entry)` and notifies. Other entries keep their references. Unknown id (e.g. evicted by the cap): silent no-op, `fn` not called, no notification.
- `clear()`: empties.
- `snapshot()`: current `readonly Entry[]`. Immutable: each change replaces the array, so an old snapshot never changes and reference equality signals change (what Solid needs).
- `subscribe(fn)`: `fn` runs after every `add`/`update`/`clear`; returns an unsubscribe function.

## Browser adapter (`src/browser/devtools.ts`)

- `toFinishedRequest(req)`: Chrome devtools `Request` to `FinishedRequest`. `request.postData` becomes `requestBody` (`undefined` when absent or without `text`). `fetchBody` wraps the callback form of `getContent`, since the promise overload is not guaranteed in Firefox's `chrome.*` namespace.
- `onRequestFinished(cb)`: subscribes to `chrome.devtools.network.onRequestFinished`, delivers mapped requests, returns an unsubscribe that removes the same listener.
- `getHAR()`: callback form of `chrome.devtools.network.getHAR`, entries mapped via `toFinishedRequest`. Chrome gives HAR entries the `Request` prototype, so `getContent` works on them (verified in e2e).
- `evalInPage(expr)`: callback form of `inspectedWindow.eval`; resolves the result, or `undefined` on `isException`/`isError`. `reloadWithScript(script)`: `inspectedWindow.reload({ injectedScript })`. `probeScript()`: fetches the extension's `probe.js` (`runtime.getURL`).
- Binary request bodies (Chrome, pinned in e2e): `postData.text` is the UTF-8 decode when the bytes are valid UTF-8, else one code unit per byte (Latin-1). Nothing is lost, but `é` + `01` could be `C3 A9 01` or `E9 01`.
- Firefox: HAR entries may lack `getContent`; harmless until something calls `getBody()` (M2). Check then.

## Wiring (`src/capture/capture.ts`, `src/panel/main.tsx`)

- `CaptureSource`: `{ onRequestFinished(cb): () => void; getHAR(): Promise<FinishedRequest[]>; onNavigated(cb): () => void; onProbe?(cb): () => void }` (`onProbe`: live probe batches, see Live capture). The adapter functions satisfy it; tests pass a fake.
- `startCapture(source, store, decoders, preserveLog)`: assigns ids from 1 (never reused, also across `clear()`), decodes once via `decodeRequest(req, decoders)`, adds `toEntry(req, id, decoded)` to the store, returns one stop function that removes both listeners.

## Backfill

- On start: subscribe live first, then `getHAR()`, so nothing finishing in between is missed.
- Live requests are buffered until the HAR read settles; then HAR entries are added (ids first), then the buffer.
- Dedupe key: `url + " " + startedDateTime`. Any live request matching a HAR key is dropped, buffered or not: Chrome delivers already-finished requests live after `getHAR` resolves (seen in e2e). Each key is forgotten on first match (a request finishes once), so the set never outgrows the HAR.
- A rejected `getHAR` counts as empty; the buffer still flushes.
- DevTools only records while its frontend is loaded; requests before DevTools opened are not in the HAR.

## Preserve log

- `onNavigated(cb)` (adapter): wraps `chrome.devtools.network.onNavigated`, ignores the url, returns an unsubscribe.
- On navigation, capture calls `store.clear()` unless `preserveLog()` returns true. It is a plain getter, read at each navigation, so capture stays Solid-free.
- Panel: "Preserve log" checkbox in the header. Off by default, not persisted across sessions.
- `main.tsx` owns the signal: `createSignal(false)`; getter to `startCapture`, getter + setter to `App`.
- `main.tsx`: `createStore()`, `startCapture({ onRequestFinished, getHAR, onNavigated }, store, decoders, preserveLog)`, renders `<App store preserveLog setPreserveLog />`.
- `App` mirrors `store.snapshot()` into a Solid signal on each `subscribe` notification; the panel never calls `getBody()`.
- Row: `METHOD STATUS KIND SUMMARY` when `decoded`, else `METHOD STATUS URL`; URL is the tooltip either way.
- Capture runs in the panel page; devtools APIs are available there in Chrome. Firefox: pending manual verification.

## Live capture (`src/probe/probe.js`, `src/capture/probe-source.ts`, `src/capture/live.ts`)

DevTools reports a request only once it finishes; a stream may never finish, and its messages never show up. A page probe records them as they arrive.
- `Entry.socket?`: `{ protocol, closeCode?, closeReason? }` on WebSocket entries.
- Probe: readable plain JS, shipped verbatim as `probe.js` (`probePlugin` in `scripts/build-manifests.ts`), never bundled or minified, outside the panel bundle. Why: Chrome Web Store (MV3) bans remote code and requires discernible functionality; AMO requires self-contained, unobfuscated add-ons with demonstrably safe dangerous-API use. The probe is bundled code, readable, runs only while the panel is open, records only, and changes nothing the page observes. No new permissions.
  - Installs once under `window[Symbol.for("snapql.probe")]` (re-injection is a no-op). State: `session` (random per install), `record(event)`, `drain()` → `{ session, events, dropped }`. Queue cap `QUEUE_CAP = 10000`, oldest dropped and counted.
  - `fetch` wrapper: returns the page's own promise; a response whose `content-type` is a stream mime (`event-stream|ndjson|jsonl|multipart/mixed`, kept in sync with `src/decoders/stream.ts` by hand) records `open` (`kind: "fetch"`, method, `res.url` or the input URL, status, mime, string request body, time), then a `chunk` per read of `res.clone().body` (streaming `TextDecoder`), then `close`. The page reads its own branch untouched.
  - `EventSource` subclass: `instanceof` and statics preserved. Records `open` (`kind: "eventsource"`, `GET`, `this.url`), `event` per message (`text`, named `event`, `lastId`), `close` once (page `close()` or `error` with `readyState` 2). Named events reach only listeners of their type, so a recorder is added per type the page listens to, plus `message`: named events the page never listens to are not captured live.
  - `WebSocket` subclass: `instanceof` and statics preserved. Records `open` (`kind: "websocket"`, method `WS`, `this.url`, requested `protocols` normalized to an array), `ready` on the native `open` event (negotiated `protocol`), a `frame` per `send` (`out`) and `message` (`in`) with `text`, or `text: ""` and `bytes` (`byteLength ?? size`) for binary, and `close` once (`code`, `reason`).
- `pollProbe(deps, cb)` (pure, deps injected): injects at start and on `onNavigated`; every `POLL_MS = 250` while `visible()` evaluates `DRAIN` (`window[Symbol.for("snapql.probe")]?.drain()`); passes batches with events to `cb`; a drain returning `undefined` (new document, or injection lost the race) re-injects; a tick is skipped while one is pending. Polling is the only page-to-panel channel without permissions. `main.tsx` wires it to `evalInPage`/`probeScript` as `onProbe`.
- `createLive(store, decoders, nextId)` (`apply(drained)`, `claim(req)`, `reset()`): streams keyed `${session}:${id}` (probe ids restart per install).
  - `open`: entry from the shared id counter, `open: true`, `messages: []`, `exchange` empty, decoded from method/url/status/mime/string body (so a live LLM fetch is `llm` at once). Fetch entries' `getBody` gives the raw text so far (capped at `FRAME_LIMIT`, head kept), so Body and response decoding update live; EventSource entries reject until finished.
  - `chunk`: raw appended; parsed with `streamParser(mime)` into messages stamped with the chunk time (`incoming`). `event`: one message (`event`, `id` from `lastId`). `close`: parser flushed, `open: false`.
  - Merge: `startCapture`'s `add` first calls `claim(req)`: the earliest unclaimed live entry with the same method and URL is replaced by `toEntry(req)` keeping its id, decode, messages and dropped count, with `open: false`. No duplicate row; Body becomes the finished body.
  - Sockets: `open` gives method `WS`, status 101, `protocols` in the decode input (kind `websocket`), `socket: { protocol: "" }`, a rejecting `getBody`. `ready` sets `socket.protocol`; `frame` appends `{ dir, time, text, bytes? }`; `close` sets `open: false`, `time` (duration) and `socket.closeCode`/`closeReason`.
  - Handshake merge: Chrome reports a socket's handshake only after the socket closes, as a finished `GET ws://...` with the handshake headers (verified in e2e). `claim` matches a `WS` stream to a `GET` on the same URL; the socket entry keeps everything and only takes `exchange`. Without it every socket would show twice.
  - Navigation calls `reset()`: tracked entries get `open: false` (their page is gone, no close will come) and are forgotten; with Preserve log off the store is cleared as before.
- `dropped` is ignored: it can't be attributed to an entry.
- Reload and capture: `reloadWithScript(probe)` runs the probe before any page script, catching streams opened while loading (a plain reload re-injects after the page's scripts may have started them).
- Limits: streams opened before injection (without Reload and capture); unlistened named EventSource events; Firefox evaluates only in the main frame (no iframes). Firefox `inspectedWindow.reload({ injectedScript })`: supported per Firefox source (`ext-devtools-inspectedWindow.js` passes it to the reload command); manual verification in Firefox pending.

## Invariants

- No `solid-js` or `chrome.*` in `src/capture/`.
- Store length never exceeds `cap`.
- Bodies fetched only via `getBody()`, at most once per entry; decoding never fetches.

## Key files

- `src/capture/entry.ts`, `src/capture/entry.test.ts`
- `src/capture/store.ts`, `src/capture/store.test.ts`
- `src/capture/test-helpers.ts`: re-exports `emptyExchange` for tests
- `src/capture/live.ts`, `src/capture/probe-source.ts` (+ `.test.ts`), `src/probe/probe.js` (+ `probe.test.ts`, runs the shipped text against fake globals)
- `src/capture/capture.ts`, `src/capture/capture.test.ts`
- `src/browser/devtools.ts`, `src/browser/devtools.test.ts`
- `src/panel/main.tsx`, `src/panel/app.tsx`

## Related

- `docs/overview.md`
- `docs/build.md`
- `docs/decoders.md`
