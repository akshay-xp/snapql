# Panel

Solid UI in `src/panel/`: header, request list, detail pane. Reads entries from the capture store; never touches `chrome.*` directly (theme comes through `src/browser/devtools.ts`).

## Layout (`src/panel/app.tsx`)

- No header bar.
- Type: UI text in Tailwind `font-sans` at 12px (`text-xs` on `main`); `font-mono` only on code and data: `<pre>` blocks (Body, Raw, Summary sections, Tokens), `Pairs` lists, Summary `<dd>` values.
- Body: flex row. Left `<section>` (`flex-1 flex-col`): `SearchBox`, then `Waiting` when the store is empty ("Waiting for requests", "Reload the page to capture its traffic."), else `NoMatches` when the filter hides everything, else `List`; then `Footer`. `Waiting` and `NoMatches` share the centered `Message` layout. `Detail` right when an entry is selected.
- Footer (`src/panel/footer.tsx`): icon buttons, each with `aria-label` = `title`: Clear; sort (`Newest first` / `Oldest first`, the current order, icon flips); Preserve log (`aria-pressed`, `text-accent` when on). Then the count, `count(n, "request")` (`0 requests`, `1 request`), or `<shown> of <total>` while a query is set (`total` prop given only then). Icons inline SVG, `aria-hidden`.
- Divider (`src/panel/splitter.tsx`, `src/panel/splitter.ts`): an `<hr aria-orientation="vertical">` (implicit `separator` role; Biome prefers the native element) absolutely positioned over the detail pane's left border, so it takes no layout width and list + detail always fill the row.
  - Drag: `pointerdown` on the handle adds `pointermove`/`pointerup` listeners on `window` (drag survives leaving the handle; also works with the e2e's synthetic events), removed on release or unmount.
  - `App` owns `detailWidth` (undefined = 50%, until the first drag; not persisted). Width = row's right edge minus pointer x, through `clampWidth(width, container, MIN_PANE)`: each side keeps at least `MIN_PANE` (200px); a row narrower than 400px splits in half.
  - Pointer only: the handle is not focusable (keyboard resizing not in scope).

## State

- `entries`: Solid signal mirroring `store.snapshot()` on each store notification.
- `selectedId`: signal in `App`. `selected()` derives the entry; an effect resets `selectedId` to `undefined` when the entry leaves the store (Clear, eviction, navigation), which closes the pane.
- `preserveLog`: owned by `main.tsx` (see `docs/capture.md`).
- `query`: signal in `App`, default `""`, not persisted.
- `visible`: `createMemo` in `App`: entries filtered by `matchesQuery`, then reversed when `newestFirst`. `List`, `Footer`, the no-match check and `selected()` all read it.
- `newestFirst`: signal in `App`, default `true`, not persisted. `App` passes `List` the reversed list when on; `List` knows nothing of order, so ↑/↓/Home/End follow the displayed order.

## List (`src/panel/list.tsx`, `src/panel/keys.ts`)

- `role="listbox"`, `tabIndex=0`, holds focus; rows are `role="option"` with `id="entry-<id>"` and `aria-selected`. The listbox's `aria-activedescendant` points at the selected row, so focus never moves to rows (survives virtualization later). Rows are therefore not focusable and have no key handlers (two Biome a11y rules suppressed with that reason).
- Row: 28px (`h-7`), parts from `rowLabel(entry)` (`src/panel/row.ts`, pure), in order: title (`flex-1 truncate`, URL tooltip), detail, failure pill, kind tag.
  - Decoded: the decoder's `title`, `detail`, `kind`. Undecoded: title = path + query (repeated calls to one endpoint stay distinguishable), detail = method, no kind.
  - `failure`: status code when `>= 400`, `failed` when status is 0; pill `bg-error text-bg` (no extra token, passes contrast). No method/status columns.
  - Kind tag `w-16` (64px), bordered; rendered empty with a transparent border when undecoded so tags align in a column.
  - Selected row `bg-selected`; detail and tag drop `text-muted` there (muted on `selected` is under 4.5:1 in both themes).
- Virtualized (`src/panel/virtual.ts`), no library. The listbox is the scroll container holding a spacer `div` of height `count * ROW_HEIGHT`; the rendered slice `[start, end)` sits in an inner `div` with `translateY(start * ROW_HEIGHT)`.
  - `ROW_HEIGHT = 24` in `list.tsx` must match the rows' `h-6` (border-box, border included). Overscan 10 rows each side.
  - `visibleRange(scrollTop, viewportHeight, rowHeight, count, overscan)` (pure): `start = max(0, floor(scrollTop/rowHeight) - overscan)`, `end = min(count, ceil((scrollTop+viewportHeight)/rowHeight) + overscan)`.
  - `scrollTop` comes from `onScroll`, viewport height from a `ResizeObserver` on the listbox (disconnected on cleanup).
  - Keyboard moves call `scrollToRow(index, scrollTop, viewportHeight, rowHeight)` (pure: new `scrollTop` aligning the row's top or bottom edge, or `undefined` if fully visible) and set `scrollTop`, so the selected row is rendered and `aria-activedescendant` always resolves.
- Keys (`nextIndex(key, current, count)`, pure): ↑/↓ move and clamp; ↓ with no selection selects the first row, ↑ the last; Home/End jump; empty list or other keys do nothing. Moving selects (like the Network panel), so there is no Enter. Esc deselects (closes the pane). Click selects.

## Search (`src/panel/search.tsx`, `src/panel/filter.ts`)

- `SearchBox`: `h-10` bar atop the list; `<input type="search" aria-label="Filter requests">` (native cancel button hidden) inside a `surface` pill with an accent focus ring; × `IconButton` (`Clear filter`) only while the query is non-empty.
- `matchesQuery(entry, query)` (pure): case-insensitive substring over what the row shows (`rowLabel` title, detail, kind) plus the full URL; empty query matches all. Decoded rows don't show their method, so `POST` doesn't match a GraphQL row.
- `highlight(text, query)` (pure): `{ text, hit }` segments, every occurrence, original casing, query matched literally (`indexOf`, no regex). `Marked` renders hits as `<mark>` (`bg-accent/30`); `List` passes title and detail through it.
- No matches: `No requests match "<q>"` and a `Clear filter` text button that empties the query.
- When the filter hides the selected entry, `selected()` (looked up in `visible`) becomes `undefined` and the existing effect clears `selectedId`; clearing the query does not reselect it.

## Detail (`src/panel/detail.tsx`, `src/panel/summary.ts`)

- Active tab underlined in `border-accent`. Tabs, in order: Summary, Body, Headers, Params/Cookies, Timing, Raw. `role="tablist"`, each tab `aria-selected`/`aria-controls`, id `tab-<slug>` (`Params/Cookies` becomes `params-cookies`); one `role="tabpanel"` for the active tab.
- Click switches. ←/→ on the tablist move via `nextTab(key, current, count)` (pure, wraps at both ends, per the WAI-ARIA tabs pattern) and focus the new tab. Only the active tab is in the Tab order (`tabIndex` 0, others -1), so Tab moves list, then active tab, then panel content.
- Headers: request then response headers, `name: value`. Params/Cookies: query params, request cookies, response cookies, `name = value`; empty sections say "None". Both use `Pairs`.
- Timing: total time, then `timingRows(timings)` (pure): one row per HAR phase in order, `ms` or `-` when n/a, a bar sized by `fraction` = ms / sum of measured phases (0 when nothing measured).
- Raw: `rawRequest(entry)` (`METHOD path?query VERSION`, headers, blank line, body) and `rawResponse(entry, body)` (`VERSION STATUS TEXT`, headers, blank line, body); version falls back to `HTTP/1.1`.
- Active tab is a signal in `Detail`; it survives selection changes because the `Show` around `Detail` is not keyed.
- Summary: `<dl>` of Method, URL, Status, Kind, Title, Detail, Started (ISO), Time (ms, rounded); Kind/Title/Detail only when present.
- `dataSections(decoded.data)`: a field holding a non-empty array of `{ name: string, value: string }` becomes a rows section, rendered with `Pairs` as `name = value` (decoders use this for form fields, parts, calls). Other plain-object fields become labelled `<pre>` blocks, strings as-is (e.g. GraphQL query text), others pretty JSON (variables). Non-object data is one `data` block; `null`/`undefined` none. Protocol-agnostic: no per-decoder UI.
- Response group: when `decoderFor(decoded.kind, decoders)` has `decodeResponse` (`decoders` imported from `src/decoders/index.ts`), `ResponseGroup` loads `loadBody(entry, { pretty: false })` and renders `Response`, the response summary and `Sections` (the same `dataSections` rendering). Mounted only inside Summary, so the body loads only while Summary is shown for such an entry. Nothing renders when `decodeResponse` returns `undefined`.

## Values (`src/panel/values.ts`)

- Pure helpers for header, cookie and param values; `decodeBase64` (UTF-8) lives here and is shared with `body.ts`.
- `decodeJwt(value)`: three base64url segments (`[\w-]`; signature may be empty), header and payload must decode to plain JSON objects and the header needs a string `alg`; returns `{ header, payload, expires? }` with `expires` = `exp` as ISO. Anything else `undefined`. Never verified.
- `findTokens(exchange)`: JWTs in order from `Authorization: Bearer` (case-insensitive), request cookies (`cookie <name>`), response cookies (`set-cookie <name>`), query params (`query <name>`); non-JWT values skipped.
- `decodeValue(value)`: first match of: JWT (payload as pretty JSON); percent-decoded text (raw kept if malformed) that parses to a JSON object/array (pretty JSON); percent-decoded text when it differs from the raw value; else `undefined`.
- `Pairs` with `decode` (Headers, Params/Cookies) shows `decodeValue` as a muted `whitespace-pre-wrap` line under the raw value; Summary rows don't decode.
- Summary `Tokens` section (after decoded data, before Response), only when tokens exist: `<source> · unverified`, `expires <iso>` when present, `header` and `payload` as pretty JSON.

## Body (`src/panel/body.ts`)

- `LoadedBody` (used by Body and Raw) mounts only while its tab is active and runs `createResource(entry, loadBody)`, so bodies load on demand. Body uses `pretty: true`; Raw uses `formatBody`'s `{ pretty: false }` (truncation and base64 note still apply). The fetcher is wrapped because `createResource` passes its own info object as a second argument. `loadBody` is the panel's only `getBody()` caller (`grep -rn getBody src/panel` hits only `body.ts` and its test); `getBody` itself memoizes, so revisiting the tab does not refetch.
- `formatBody(body, { pretty, mimeType })`: `{ text, notes }`. `loadBody` passes `entry.mimeType`.
  - base64 with a text-like mime (`text/*`, `multipart/mixed`, `/json`, `+json`, contains `xml` or `javascript`): decoded as UTF-8 first, then treated as text (limit counts decoded chars). Chrome already sends `multipart/mixed` (incremental GraphQL) as text; the rule covers browsers that report it as base64.
  - Over `BODY_LIMIT` (1024 * 1024 characters): first `BODY_LIMIT` chars, note `Truncated: showing 1 MB of <n> characters`, never parsed.
  - Other `base64`: note `base64-encoded, <n> bytes` (decoded size) plus raw base64; never parsed.
  - Otherwise: pretty JSON if it parses, else `prettyXml` (from `src/decoders/xml.ts`; balanced XML indented, anything else, including HTML, as-is). Detection is by parse only; `mimeType` is used only for base64.
- Failed fetch: `{ text: "", notes: ["Body unavailable: <message>"] }`.
- Chrome reports some text responses as base64 (e.g. no `content-type`); text-like ones are decoded above, the rest stay a note. The e2e server sends `application/json` for `/graphql`.

## Themes (`src/panel/themes.ts`, `src/panel/index.css`, `src/panel/main.tsx`)

- Themes are data: `Theme = { id, name, kind, colors: Record<ColorToken, string> }`, tokens `bg, fg, muted, border, selected, error, surface, accent, success, syntax-key, syntax-string, syntax-number`. Ships `devtools-light`, `devtools-dark`.
  - `bg`, `fg`, `selected`, `error` and dark `muted` copied from the DevTools document's `--sys-color-*` variables (source noted in the file).
  - SnapQL's own: `border` (softer than DevTools' divider: dark `#3d3d3d`, light `#e3e3e3`), light `muted` `#5f6368` (DevTools' `#757575` is 4.14:1 on `surface`), `surface` (code blocks), `accent` (active tab underline), `success`, `syntax-*` (JSON/XML colors).
  - `themes.test.ts` checks every text token (`fg`, `muted`, `error`, `success`, `accent`, `syntax-*`) is at least 4.5:1 on `bg` and `surface`. Dark `muted` on `selected` is 2.9:1, so selected rows must not rely on `muted`.
- `defaultTheme(kind)` picks by DevTools kind; this is "auto" for a future VS Code-style picker (multiple light/dark themes, persisted choice). Adding a theme is one entry in `themes`.
- `main.tsx` `applyTheme(theme)`: sets `themeVars(theme)` (`--theme-<token>`) on `<html>`, plus `data-theme=<id>` and `data-theme-kind=<kind>`.
- `index.css` `@theme inline` maps Tailwind colors (`bg-bg`, `text-fg`, `border-border`, ...) to `--theme-*`. Components use tokens only, never a theme name. Biome needs `css.parser.tailwindDirectives` for this.
- Kind source: `getTheme()` (`themeName === "dark"`) at load; `onThemeChanged` in Firefox only. Chrome has no theme event, and its panel iframe's `prefers-color-scheme` flips during load (observed in e2e), so it can't stand in for one: Chrome keeps the load-time theme until the panel reopens.

## E2E harness (`e2e/harness.ts`)

- `rows()` reads rendered `[role="option"]` text (only the visible window). `optionCount()` counts rendered options; `dragDivider(dx)` dispatches pointerdown on the handle and pointermove/up on `window`; `paneWidths()` gives `{ list, detail }` (the headless panel is ~550px wide, so drags stay small); `selectedVisible()` checks the selected option lies inside the listbox. Server `/bulk` fetches `/api/item?i=0..999` in sequence (no favicon), then sets `document.title = "done"`; capture can trail the page, so the test retries Home (newest first) until the last item is selected. `press(key)` focuses the listbox and dispatches `keydown`; `select(row)` clicks the option with that text; `selectedRow()` requires `aria-activedescendant` to match; `activeTab()`, `openTab(name)`, `pressTab(key)` (focuses the active tab, dispatches `keydown`), `detail()` (tabpanel text or `null`), `text(selector)` (collapsed innerText or `null`), `attr(selector, name)`; `clear()`, `toggleSort()` and `togglePreserveLog()` click footer buttons by `aria-label`; `search(q)` sets the search input and dispatches `input`; `clearSearch()` clicks the × (`aria-label="Clear filter"`); `clickButton(text)` clicks a button by its text.
- `openPanel({ devtoolsTheme })` writes DevTools' `ui-theme` into `<userDataDir>/Default/Preferences` before launch: headless DevTools ignores emulated color schemes. `themeKind()`, `devtoolsTheme()` (DevTools `theme-with-dark-background` class), `cssVar(name)`, `style(selector, property)` (computed style of the first match, `""` if none).

## Key files

- `src/panel/main.tsx`, `src/panel/app.tsx`, `src/panel/footer.tsx`, `src/panel/search.tsx`, `src/panel/icon-button.tsx`, `src/panel/list.tsx`, `src/panel/detail.tsx`, `src/panel/splitter.tsx`
- `src/panel/keys.ts`, `src/panel/row.ts`, `src/panel/filter.ts`, `src/panel/virtual.ts`, `src/panel/splitter.ts`, `src/panel/summary.ts`, `src/panel/body.ts`, `src/panel/raw.ts`, `src/panel/timing.ts`, `src/panel/themes.ts` (+ `.test.ts`)
- `src/panel/index.css`
- `e2e/harness.ts`, `e2e/panel.test.ts`

## Related

- `docs/capture.md`: store, entries, preserve log.
- `docs/decoders.md`: where `decoded` comes from.
- `docs/overview.md`
