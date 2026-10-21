# Capture

Turns finished network requests into `Entry` objects and keeps them in a capped store the UI subscribes to. Plain TypeScript: no UI or browser API imports.

## Types (`src/capture/entry.ts`)

- `FinishedRequest`: input from the browser adapter. `method`, `url`, `status`, `startedDateTime` (ISO string), `time` (ms), `fetchBody()`.
- `Entry`: what the store holds. `id`, `method`, `url`, `status`, `startedAt` (epoch ms), `time`, `getBody()`.
- `Body`: `{ content, encoding }`; `encoding` is `""` or `"base64"`, as reported by the browser.
- `toEntry(req, id)`: maps one to the other. Capture owns `FinishedRequest` so this module never references `chrome.*`, not even in types.

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

## Invariants

- No `solid-js` or `chrome.*` in `src/capture/`.
- Store length never exceeds `cap`.
- Bodies fetched only via `getBody()`, at most once per entry.

## Key files

- `src/capture/entry.ts`, `src/capture/entry.test.ts`
- `src/capture/store.ts`, `src/capture/store.test.ts`

## Related

- `docs/overview.md`
- `docs/build.md`
