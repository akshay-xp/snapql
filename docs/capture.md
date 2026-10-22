# Capture

Turns finished network requests into `Entry` objects and keeps them in a capped store the UI subscribes to. Plain TypeScript: no UI or browser API imports.

## Types (`src/capture/entry.ts`)

- `FinishedRequest`: input from the browser adapter. `RequestView` (`method`, `url`, `status`, `requestBody?`) plus `startedDateTime` (ISO string), `time` (ms), `fetchBody()`.
- `Entry`: what the store holds. `id`, `method`, `url`, `status`, `startedAt` (epoch ms), `time`, `decoded?` (`DecodeResult`), `getBody()`.
- `Body`: `{ content, encoding }`; `encoding` is `""` or `"base64"`, as reported by the browser.
- `toEntry(req, id, decoded?)`: maps one to the other. Capture owns `FinishedRequest` so this module never references `chrome.*`, not even in types.

## Lazy bodies

- `getBody()` calls `fetchBody()` on first use and memoizes the promise; concurrent and repeated calls share one fetch.
- Nothing fetches bodies eagerly; listing requests costs no body memory.
- A rejected fetch stays cached; no retry.

## Store (`src/capture/store.ts`)

- `createStore(cap = DEFAULT_CAP)`; `DEFAULT_CAP = 5000`.
- `add(entry)`: appends; drops oldest beyond `cap`.
- `clear()`: empties.
- `snapshot()`: current `readonly Entry[]`. Immutable: each change replaces the array, so an old snapshot never changes and reference equality signals change (what Solid needs).
- `subscribe(fn)`: `fn` runs after every `add`/`clear`; returns an unsubscribe function.

## Browser adapter (`src/browser/devtools.ts`)

- `toFinishedRequest(req)`: Chrome devtools `Request` to `FinishedRequest`. `request.postData` becomes `requestBody` (`undefined` when absent or without `text`). `fetchBody` wraps the callback form of `getContent`, since the promise overload is not guaranteed in Firefox's `chrome.*` namespace.
- `onRequestFinished(cb)`: subscribes to `chrome.devtools.network.onRequestFinished`, delivers mapped requests, returns an unsubscribe that removes the same listener.
- Only requests finishing while the panel is open are seen (no HAR backfill until M1).

## Wiring (`src/capture/capture.ts`, `src/panel/main.tsx`)

- `startCapture(subscribe, store, decoders)`: assigns ids from 1 (never reused, also across `clear()`), decodes once via `decodeRequest(req, decoders)`, adds `toEntry(req, id, decoded)` to the store, returns the unsubscribe.
- `main.tsx`: `createStore()`, `startCapture(onRequestFinished, store, decoders)`, renders `<App store={store} />`.
- `App` mirrors `store.snapshot()` into a Solid signal on each `subscribe` notification; the panel never calls `getBody()`.
- Row: `METHOD STATUS KIND SUMMARY` when `decoded`, else `METHOD STATUS URL`; URL is the tooltip either way.
- Capture runs in the panel page; devtools APIs are available there in Chrome. Firefox: pending manual verification.

## Invariants

- No `solid-js` or `chrome.*` in `src/capture/`.
- Store length never exceeds `cap`.
- Bodies fetched only via `getBody()`, at most once per entry; decoding never fetches.

## Key files

- `src/capture/entry.ts`, `src/capture/entry.test.ts`
- `src/capture/store.ts`, `src/capture/store.test.ts`
- `src/capture/capture.ts`, `src/capture/capture.test.ts`
- `src/browser/devtools.ts`, `src/browser/devtools.test.ts`
- `src/panel/main.tsx`, `src/panel/app.tsx`

## Related

- `docs/overview.md`
- `docs/build.md`
- `docs/decoders.md`
