# Panel

Solid UI in `src/panel/`: header, request list, detail pane. Reads entries from the capture store; never touches `chrome.*` directly (theme comes through `src/browser/devtools.ts`).

## Layout (`src/panel/app.tsx`)

- No header bar.
- Type: labels (tabs, section headings, buttons, search placeholder, footer count, messages, Timing phase names) in Tailwind `font-sans` at 12px (`text-xs` on `main`); everything from the request is `font-mono`: rows, the Summary heading and meta line, `<pre>` blocks, pairs, JSON trees, token expiry, Timing values.
- Body: flex row, or flex column when stacked (below). Left (top when stacked) `<section>` (`flex-1 flex-col`): `SearchBox`, then `Waiting` when the store is empty ("Waiting for requests", "Reload the page to capture its traffic.", and a `Reload and capture` text button), else `NoMatches` when the filter hides everything, else `List`; then `Footer`. `Waiting` and `NoMatches` share the centered `Message` layout. `Detail` right (below when stacked) when an entry is selected.
- Stacking: `isStacked(width, height)` (`width < height`, pure) from a `ResizeObserver` on the row. A side-docked DevTools (tall) stacks list over detail; bottom-docked (wide) puts them side by side, like DevTools' own auto panel layout.
- Footer (`src/panel/footer.tsx`): icon buttons, each with `aria-label` = `title`: Clear; sort (`Newest first` / `Oldest first`, the current order, icon flips); Preserve log (`aria-pressed`, `text-accent` when on); Reload and capture (reloads with the probe injected first, see `docs/capture.md`). Then the count, `count(n, "request")` (`0 requests`, `1 request`), or `<shown> of <total>` while a query is set (`total` prop given only then). Icons inline SVG, `aria-hidden`.
- Divider (`src/panel/splitter.tsx`, `src/panel/splitter.ts`): an `<hr aria-orientation>` (implicit `separator` role; Biome prefers the native element) absolutely positioned over the detail pane's left border (`vertical`) or top border (`horizontal`, when stacked), so it takes no layout space and list + detail always fill the row.
  - Drag: `pointerdown` on the handle adds `pointermove`/`pointerup` listeners on `window` (drag survives leaving the handle; also works with the e2e's synthetic events), removed on release or unmount.
  - `App` owns `detailWidth` and `detailHeight` (undefined = 50%, until the first drag in that layout; not persisted); `Detail` gets the one for the current layout as `size`. Width = row's right edge minus pointer x, height = row's bottom minus pointer y, through `clampSize(size, container, MIN_PANE)`: each side keeps at least `MIN_PANE` (200px); a row smaller than 400px splits in half.
  - Pointer only: the handle is not focusable (keyboard resizing not in scope).

## State

- `entries`: Solid signal mirroring `store.snapshot()` on each store notification.
- `selectedId`: signal in `App`. `selected()` derives the entry; an effect resets `selectedId` to `undefined` when the entry leaves the store (Clear, eviction, navigation), which closes the pane.
- `preserveLog`: owned by `main.tsx` (see `docs/capture.md`).
- `query`: signal in `App`, default `""`, not persisted.
- `visible`: `createMemo` in `App`: entries filtered by `matchesQuery`, then reversed when `newestFirst`. `List`, `Footer`, the no-match check and `selected()` all read it.
- `newestFirst`: signal in `App`, default `true`, not persisted. `App` passes `List` the reversed list when on; `List` knows nothing of order, so ↑/↓/Home/End follow the displayed order.

## List (`src/panel/list.tsx`, `src/panel/virtual-listbox.tsx`, `src/panel/keys.ts`)

- `VirtualListbox<T>({ items, key, selected, onSelect, label, idPrefix, children(item, selected) })` owns everything below except row contents: listbox ARIA, virtualization, keys, the `h-7` `role="option"` row wrapper. Used by the request list (`Requests`, `entry-`) and Messages (`Messages`, `message-`).

- `role="listbox"`, `tabIndex=0`, holds focus; rows are `role="option"` with `id="entry-<id>"` and `aria-selected`. The listbox's `aria-activedescendant` points at the selected row, so focus never moves to rows (survives virtualization later). Rows are therefore not focusable and have no key handlers (two Biome a11y rules suppressed with that reason).
- Row: 28px (`h-7`), parts from `rowLabel(entry)` (`src/panel/row.ts`, pure), in order: title (`flex-1 truncate`, URL tooltip), detail, failure pill, `live` tag, message count, kind tag.
  - Decoded: the decoder's `title`, `detail`, `kind`. Undecoded: title = path + query (repeated calls to one endpoint stay distinguishable), detail = method, no kind.
  - `failure`: status code when `>= 400`, `failed` when status is 0; pill `bg-error text-bg` (no extra token, passes contrast). No method/status columns.
  - `live`: open streams (`entry.open`), in `text-accent` (plain on the selected row).
  - `closed`: `closed <code>` for a closed socket (muted), where `live` was.
  - `count`: `<n> msgs` (muted) only when the entry has `messages` (live streams, sockets). Finished-body streams show none: counting them would load every body.
  - Kind tag `w-[11ch]` (fits the longest kind, `multipart`, in mono), bordered; rendered empty with a transparent border when undecoded so tags align in a column.
  - Selected row `bg-selected`; detail and tag drop `text-muted` there (muted on `selected` is under 4.5:1 in both themes).
- Virtualized (`src/panel/virtual.ts`), no library. The listbox is the scroll container holding a spacer `div` of height `count * ROW_HEIGHT`; the rendered slice `[start, end)` sits in an inner `div` with `translateY(start * ROW_HEIGHT)`.
  - `ROW_HEIGHT = 28` in `virtual-listbox.tsx` must match the rows' `h-7` (border-box, border included). Overscan 10 rows each side.
  - `visibleRange(scrollTop, viewportHeight, rowHeight, count, overscan)` (pure): `start = max(0, floor(scrollTop/rowHeight) - overscan)`, `end = min(count, ceil((scrollTop+viewportHeight)/rowHeight) + overscan)`.
  - `scrollTop` comes from `onScroll`, viewport height from a `ResizeObserver` on the listbox (disconnected on cleanup).
  - Keyboard moves call `scrollToRow(index, scrollTop, viewportHeight, rowHeight)` (pure: new `scrollTop` aligning the row's top or bottom edge, or `undefined` if fully visible) and set `scrollTop`, so the selected row is rendered and `aria-activedescendant` always resolves.
- Keys (`nextIndex(key, current, count)`, pure): ↑/↓ move and clamp; ↓ with no selection selects the first row, ↑ the last; Home/End jump; empty list or other keys do nothing. Moving selects (like the Network panel), so there is no Enter. Esc deselects (closes the pane). Click selects.

## Search (`src/panel/search.tsx`, `src/panel/filter.ts`)

- `SearchBox`: `h-10` `<search>` bar atop the list (same height as the tab bar, so they line up side by side); `<input type="search" aria-label="Filter requests">` (native cancel button hidden) inside a `surface` pill with an accent focus ring; × `IconButton` (`Clear filter`) only while the query is non-empty.
- `matchesQuery(entry, query)` (pure): case-insensitive substring over what the row shows (`rowLabel` title, detail, kind) plus the full URL; empty query matches all. Decoded rows don't show their method, so `POST` doesn't match a GraphQL row.
- `highlight(text, query)` (pure): `{ text, hit }` segments, every occurrence, original casing, query matched literally (`indexOf`, no regex). `Marked` renders hits as `<mark>` (`bg-accent/30`); `List` passes title and detail through it.
- No matches: `No requests match "<q>"` and a `Clear filter` text button that empties the query.
- When the filter hides the selected entry, `selected()` (looked up in `visible`) becomes `undefined` and the existing effect clears `selectedId`; clearing the query does not reselect it.

## Detail (`src/panel/detail.tsx`, `src/panel/summary.ts`)

- Active tab underlined in `border-accent`. Tabs, in order: Summary, Body, Messages, Headers, Params/Cookies, Timing, Raw. `tabsFor(entry)` (`src/panel/tabs.ts`, pure) gives sockets `Summary, Messages, Headers` (no body, params or timing; Headers holds the handshake Chrome reports after close); otherwise it includes Messages only for a stream mime (`streamParser` exists) or an entry with `messages`; `shownTab(active, tabs)` falls back to Summary when the kept active tab is hidden for the new entry. `role="tablist"`, each tab `aria-selected`/`aria-controls`, id `tab-<slug>` (`Params/Cookies` becomes `params-cookies`); one `role="tabpanel"` for the active tab.
- Spacing: tab bar `h-10` (scrolls horizontally if the tabs don't fit); tabpanel `p-3`, `flex-col gap-4`, so every top-level block (heading, sections, Response group, toolbar) is 16px apart and sections carry no margins. Section: `h-6` heading row, `gap-1.5`, block `px-3 py-2`. Raw shows Request and Response as `Section`s.
- Wrapping: text wraps at spaces first, breaking long tokens only when needed (`overflow-wrap: anywhere`, not `break-all`) in `<pre>`, pairs, JSON trees and the heading title. Pairs key column `fit-content(40%)`, so long keys wrap instead of squeezing values.
- Click switches. ←/→ on the tablist move via `nextTab(key, current, count)` (pure, wraps at both ends, per the WAI-ARIA tabs pattern) and focus the new tab. Only the active tab is in the Tab order (`tabIndex` 0, others -1), so Tab moves list, then active tab, then panel content.
- Headers: request then response headers. Params/Cookies: query params, request cookies, response cookies. Both use `Pairs`; empty sections say "None".
- `Pairs(title, pairs, decode?)`: a `Section` holding `<dl data-section={title}>`, grid `max-content | minmax(0,1fr)`, mono; `<dt>` key in `syntax-key`, `<dd>` with `<span data-value>` (red `text-error` when the section is named `errors`, e.g. GraphQL response errors: a generic rule, no per-decoder UI) and the optional decoded line.
- Timing: total time, then `timingRows(timings)` (pure): one row per HAR phase in order, `ms` or `-` when n/a, a bar sized by `fraction` = ms / sum of measured phases (0 when nothing measured).
- Raw: `rawRequest(entry)` (`METHOD path?query VERSION`, headers, blank line, body) and `rawResponse(entry, body)` (`VERSION STATUS TEXT`, headers, blank line, body); version falls back to `HTTP/1.1`.
- Active tab is a signal in `Detail`; it survives selection changes because the `Show` around `Detail` is not keyed.
- Summary heading (`src/panel/heading.ts`, `src/panel/copy.ts`, `summaryHeading(entry)`, pure): `<header>` with the title (`rowLabel`'s, 15px semibold) and a tag `<kind> <detail>` (absent when undecoded); then a muted meta line `METHOD path · <status> · <ms> ms · HH:MM:SS`.
  - `path` = pathname + search; the full URL is its tooltip (`data-path`). The host is not shown.
  - `status`: `<code> <statusText>` (trimmed), `failed` for 0, `closed <code>` for a closed socket (`ok` for 1000 and 1005, `cleanClose` in `src/panel/socket.ts`); `data-status` in `success` when `0 < status < 400`, else `error`. Clock is local time from `startedAt`.
- `Section(title, copy?, children)`, `Text`, `Pairs` and `Sections` live in `src/panel/section.tsx` (shared with Messages): `<section>` with a muted semibold `<h2>` and a `data-block` `surface` block. Used by decoded sections, `Pairs` and Tokens (one block per token).
- `dataSections(decoded.data)`: a field holding a non-empty array of `{ name: string, value: string }` becomes a rows section, rendered with `Pairs` (decoders use this for form fields, parts, calls). Other fields become labelled sections: strings as `{ name, text }` (`<pre>`, e.g. GraphQL query text), everything else as `{ name, json }` (`JsonTree`, e.g. variables). Non-object data is one `data` section; `null`/`undefined` none. Protocol-agnostic: no per-decoder UI.
- Socket section (sockets only, before decoded sections): `Pairs` from `socketRows(entry)` (`src/panel/socket.ts`, pure): `protocol` (negotiated, `none`), `frames sent`, `frames received`, then `close code`, `close reason` once known (empty reason omitted).
- Response group: when `decoderFor(decoded.kind, decoders)` has `decodeResponse` (`decoders` imported from `src/decoders/index.ts`), `ResponseGroup` loads `loadBody(entry, { pretty: false })` and renders a group heading `Response · <summary>` over its `Sections` (the same `dataSections` rendering). Mounted only inside Summary, so the body loads only while Summary is shown for such an entry. Nothing renders when `decodeResponse` returns `undefined`.

## Messages (`src/panel/messages.tsx`, `src/panel/messages.ts`)

- Tab content: an entry with `messages` (live capture) shows them directly, `timed`; otherwise `LoadedBody` (`pretty: false`, so the body loads only while the tab is shown), `parseStream(entry.mimeType, text)`, then `bodyMessages(events, entry.startedAt)` (`dir: "in"`, start time). `Messages({ messages, timed })` lists them in a bordered `VirtualListbox` (`min-h-24 flex-1`).
- Row, mono (offset, event and size drop their muted/syntax color on the selected row, as request rows do): offset `+1.234s` from the first message (only when `timed`: live messages; body-parsed ones share one time), `event` in `syntax-key`, `preview(text)` (whitespace collapsed, CSS-truncated), size muted at the right.
- `directions` (Detail sets it for sockets): a muted `arrow(dir)` (`↑` sent, `↓` received) after the offset. Streams only arrive, so no arrows there.
- Decoded frames: Detail passes `decode` built from the entry's decoder `decodeMessage` (with `entry.messages` as `frames`); `Messages` calls it per rendered row. `frameLabel(m, decoded?)` (pure) gives the decoded title and a muted detail, else `messageText`. The selected decoded frame shows its `data` as a `JsonTree` (raw text when `data` is not an object); Copy still copies the raw frame.
- `messageText(m)`: `binary <size>` for binary frames (`bytes` set), else `preview(text)`; the selected binary frame shows it too.
- Labels (pure): `byteLabel` base 1000 (`999 B`, `1.2 kB`, `1.5 MB`); `messageBytes` = `bytes` (binary frames) or UTF-8 length; `offsetLabel`.
- Selecting (click, ↑/↓) shows `Message <n>` below the list (`max-h-1/2`, scrolls): `Section` with Copy (raw text), `JsonTree` when `treeValue(text)` (`src/panel/json.ts`: JSON object or array, shared with Body) else `Text`. Keyed by message, so a `Copied` state never carries to another message. Detail keys `Messages` by entry id: live updates replace `messages` on every append, so selection resets only when another entry is shown.
- `VirtualListbox` `follow`: when the list was at the bottom (within a row) as items grow, it scrolls to the new bottom; scrolled up, it stays put. Messages sets it.

## JSON tree (`src/panel/json-tree.tsx`, `src/panel/json.ts`)

- `JsonTree(props: { value, openDepth? })`, hand-written, `font-mono`. Used for Summary `json` sections, Tokens header/payload and the Body tab.
- Rules (pure, `json.ts`): `children(value)` (arrays by index, plain objects by entries, else leaf); `startsOpen(depth, openDepth = OPEN_DEPTH)` with `OPEN_DEPTH = 3` (depth >= 3 starts collapsed); `sizeLabel` for collapsed nodes (`{…} 2 keys`, `[…] 1 item`, empty `{}`/`[]`); `brackets` for open ones (`{2}`); `clip(text)` at `STRING_LIMIT = 200`.
- Branch node: caret `<button aria-expanded>` (`▾`/`▸`, `aria-label` = key, or `JSON` at the root), key, `brackets` or `sizeLabel`; children indented `pl-4`. Its `open` signal starts at `startsOpen` and resets when `openDepth` changes (Expand all).
- Leaves: key `data-json="key"` `text-syntax-key`; strings `data-json="string"` `text-syntax-string` (quoted via `JSON.stringify`; clipped ones end `…` plus a `show more` button that reveals the rest); numbers/booleans `data-json="number"` `text-syntax-number`; `null` `data-json="null"` and empty objects/arrays `data-json="empty"`, both muted.
- Body tab (`BodyView`): a right-aligned `Toolbar` with `Expand all` (only when the pretty text parses as an object or array; sets `openDepth` to `Infinity`) and `Copy`, above the tree or `<pre>` text. Truncated/base64 bodies don't parse, so they stay text. Expand all sits in the panel, not the tab bar: the tab bar can't know whether the lazily loaded body is JSON. Raw always text.

## Copy (`src/panel/copy.ts`, `src/panel/copy-button.tsx`)

- `valueText(value)`: strings as-is, everything else `JSON.stringify(value, null, 2)`. `pairsText(pairs)`: `name = value` lines.
- Summary: every `Section` with `copy` shows a `CopyButton` (`aria-label` `Copy <title>`) right of its heading. Decoded sections copy `valueText` of their text or JSON; `Pairs` copy `pairsText` (Headers and Params/Cookies too); Tokens copy `valueText({ header, payload })`.
- Body and Raw: captioned `Copy` in the panel's `Toolbar` row (not the tab bar: it can't know the lazily loaded body). Body copies the displayed (pretty) text; Raw copies `rawRequest` + blank line + `rawResponse`, so `RawPanel` renders entirely inside `LoadedBody`.
- `copyToClipboard(text)`: `navigator.clipboard.writeText`, falling back (on rejection or a missing API: DevTools panel frames can block it) to a hidden fixed `textarea`, `select()`, `document.execCommand("copy")`, remove.
- `CopyButton(label, value, captioned?)`: an `IconButton` (copy icon; check icon while copied) whose `aria-label`/`title` (and caption, when `captioned`) read `Copied` for `COPIED_MS` (1500), then revert; timer cleared on cleanup. `IconButton` gained an optional visible `caption`.

## Values (`src/panel/values.ts`)

- Pure helpers for header, cookie and param values; `decodeBase64` (UTF-8) lives here and is shared with `body.ts`.
- `decodeJwt(value)`: three base64url segments (`[\w-]`; signature may be empty), header and payload must decode to plain JSON objects and the header needs a string `alg`; returns `{ header, payload, expires? }` with `expires` = `exp` as ISO. Anything else `undefined`. Never verified.
- `findTokens(exchange)`: JWTs in order from `Authorization: Bearer` (case-insensitive), request cookies (`cookie <name>`), response cookies (`set-cookie <name>`), query params (`query <name>`); non-JWT values skipped.
- `decodeValue(value)`: first match of: JWT (payload as pretty JSON); percent-decoded text (raw kept if malformed) that parses to a JSON object/array (pretty JSON); percent-decoded text when it differs from the raw value; else `undefined`.
- `Pairs` with `decode` (Headers, Params/Cookies) shows `decodeValue` as a muted `whitespace-pre-wrap` line under the raw value; Summary rows don't decode.
- Summary `Tokens` section (after decoded data, before Response), only when tokens exist: `<source> · unverified`, `expires <iso>` when present, `header` and `payload` as `JsonTree`s.

## Body (`src/panel/body.ts`)

- `LoadedBody` (used by Body and Raw) renders notes, then its `children(text)`; it mounts only while its tab is active and runs `createResource(entry, loadBody)`, so bodies load on demand. Body uses `pretty: true`; Raw uses `formatBody`'s `{ pretty: false }` (truncation and base64 note still apply). The fetcher is wrapped because `createResource` passes its own info object as a second argument. `loadBody` is the panel's only `getBody()` caller (`grep -rn getBody src/panel` hits only `body.ts` and its test); `getBody` itself memoizes, so revisiting the tab does not refetch.
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

- Live: `/live` (buttons `#es`: EventSource on `/api/live` closing on `done`; `#fetch`: reads `/api/live-fetch?n=20`), `/early` (EventSource opened while loading), `/socket` (`#open`: WebSocket to `/sock` with `["chat"]`, sends `hi` and 4 binary bytes on open; `#close`: `close(1000, "bye")`; `#sio`: Socket.IO-framed socket on `/socket.io/?EIO=4&transport=websocket` sending `40`, a `chat` event, `2`; `#gql`: `graphql-transport-ws` socket on `/graphql-ws` sending `connection_init`, `subscribe` (id 1, `OnMsg`), `next` (id 1)). The test server runs a `ws` `WebSocketServer` echoing every frame (binary kept binary). `/api/live*` holds the response open: `n` events (default 10) every `ms` (default 150), then `event: done`, then ends. `probed()` checks the probe is in the page; `selectStarting(prefix)` clicks a row by text prefix (live rows change); `scrollList(label, top|bottom)`, `scrollState(label)` (`{ top, gap }`).
- Request-row helpers (`rows`, `select`, `press`, `selectedRow`, `optionCount`, `paneBoxes`, ...) are scoped to the `Requests` listbox, since Messages adds a second one. `messages()` reads rendered Messages rows; `press(key, list = "Requests")` targets a listbox by label. Server `/streams` fetches `/api/sse` (3 events: plain, `event: ping`, two-line data) , `/api/ndjson` (3 lines) and POSTs a streaming `gpt-test` body to `/v1/chat/completions` (Chat Completions SSE: text, one tool call in pieces, `[DONE]`); `/api/gql-defer` (on `/decoders`) is multipart/mixed.
- `rows()` reads rendered `[role="option"]` text (only the visible window). `optionCount()` counts rendered options; `dragDivider(dx)` dispatches pointerdown on the handle and pointermove/up on `window`; `paneWidths()` gives `{ list, detail }` (the headless panel is ~550px wide, so drags stay small); `selectedVisible()` checks the selected option lies inside the listbox. Server `/bulk` fetches `/api/item?i=0..999` in sequence (no favicon), then sets `document.title = "done"`; capture can trail the page, so the test retries Home (newest first) until the last item is selected. `press(key)` focuses the listbox and dispatches `keydown`; `select(row)` clicks the option with that text; `selectedRow()` requires `aria-activedescendant` to match; `activeTab()`, `openTab(name)`, `pressTab(key)` (focuses the active tab, dispatches `keydown`), `detail()` (tabpanel text or `null`), `text(selector)` (collapsed innerText or `null`), `attr(selector, name)`; `clear()`, `toggleSort()` and `togglePreserveLog()` click footer buttons by `aria-label`; `search(q)` sets the search input and dispatches `input`; `clearSearch()` clicks the × (`aria-label="Clear filter"`); `clickButton(text)` clicks a button by its text; `click(selector)` clicks the first match; `stubClipboard()` replaces `navigator.clipboard.writeText` in the panel with a recorder read by `copied()`; `pairs()` gives the tabpanel's `dt`/`dd` pairs as `name = value` lines (value from `[data-value]`). Server `/api/users/1` returns nested JSON with a 250-char `bio` to exercise collapsing and show more.
- `openPanel({ devtoolsTheme })` writes DevTools' `ui-theme` into `<userDataDir>/Default/Preferences` before launch: headless DevTools ignores emulated color schemes. `themeKind()`, `devtoolsTheme()` (DevTools `theme-with-dark-background` class), `cssVar(name)`, `style(selector, property)` (computed style of the first match, `""` if none). `dock(side)` docks DevTools `right` (default, ~554×606 panel, stacked) or `bottom` (wide, side by side) via `DockController`; window emulation would not change the panel width, the dock split sets it. `screenshot(file)` saves a PNG of the DevTools window for visual review (not used by assertions). `paneBoxes()` gives list and detail rects; `overflowing(selector)` lists matches whose content is wider than their box; `dragDivider(dx, dy?)`.

## Key files

- `src/panel/main.tsx`, `src/panel/app.tsx`, `src/panel/footer.tsx`, `src/panel/search.tsx`, `src/panel/icon-button.tsx`, `src/panel/json-tree.tsx`, `src/panel/copy-button.tsx`, `src/panel/list.tsx`, `src/panel/virtual-listbox.tsx`, `src/panel/detail.tsx`, `src/panel/section.tsx`, `src/panel/messages.tsx`, `src/panel/splitter.tsx`
- `src/panel/keys.ts`, `src/panel/row.ts`, `src/panel/heading.ts`, `src/panel/filter.ts`, `src/panel/json.ts`, `src/panel/virtual.ts`, `src/panel/splitter.ts`, `src/panel/summary.ts`, `src/panel/body.ts`, `src/panel/raw.ts`, `src/panel/timing.ts`, `src/panel/themes.ts`, `src/panel/tabs.ts`, `src/panel/messages.ts` (+ `.test.ts`)
- `src/panel/index.css`
- `e2e/harness.ts`, `e2e/panel.test.ts`

## Related

- `docs/capture.md`: store, entries, preserve log.
- `docs/decoders.md`: where `decoded` comes from.
- `docs/overview.md`
