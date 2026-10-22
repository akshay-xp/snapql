# Panel

Solid UI in `src/panel/`: header, request list, detail pane. Reads entries from the capture store; never touches `chrome.*` directly (theme comes through `src/browser/devtools.ts`).

## Layout (`src/panel/app.tsx`)

- Header: title, Preserve log checkbox, Clear.
- Body: flex row. `List` left, `Detail` right (fixed 50% until the divider lands, #18) when an entry is selected.

## State

- `entries`: Solid signal mirroring `store.snapshot()` on each store notification.
- `selectedId`: signal in `App`. `selected()` derives the entry; an effect resets `selectedId` to `undefined` when the entry leaves the store (Clear, eviction, navigation), which closes the pane.
- `preserveLog`: owned by `main.tsx` (see `docs/capture.md`).

## List (`src/panel/list.tsx`, `src/panel/keys.ts`)

- `role="listbox"`, `tabIndex=0`, holds focus; rows are `role="option"` with `id="entry-<id>"` and `aria-selected`. The listbox's `aria-activedescendant` points at the selected row, so focus never moves to rows (survives virtualization later). Rows are therefore not focusable and have no key handlers (two Biome a11y rules suppressed with that reason).
- Row: 24px (`h-6`). Method, status (`text-error` when `>= 400`), then `kind` + `summary` if decoded, else URL; URL is the tooltip. Selected row `bg-selected`.
- Keys (`nextIndex(key, current, count)`, pure): ↑/↓ move and clamp; ↓ with no selection selects the first row, ↑ the last; Home/End jump; empty list or other keys do nothing. Moving selects (like the Network panel), so there is no Enter. Esc deselects (closes the pane). Click selects.

## Detail (`src/panel/detail.tsx`, `src/panel/summary.ts`)

- `role="tablist"` with one tab, Summary (`aria-selected`, `aria-controls`), and its `role="tabpanel"`. More tabs arrive in #15/#16.
- Summary: `<dl>` of Method, URL, Status, Kind, Summary, Started (ISO), Time (ms, rounded); Kind/Summary only when decoded.
- `dataSections(decoded.data)`: plain-object fields become labelled `<pre>` blocks, strings as-is (e.g. GraphQL query text), others pretty JSON (variables). Non-object data is one `data` block; `null`/`undefined` none. Protocol-agnostic: no per-decoder UI.

## Themes (`src/panel/themes.ts`, `src/panel/index.css`, `src/panel/main.tsx`)

- Themes are data: `Theme = { id, name, kind, colors: Record<ColorToken, string> }`, tokens `bg, fg, muted, border, selected, error`. Ships `devtools-light`, `devtools-dark`; values copied from the DevTools document's `--sys-color-*` variables (source noted in the file).
- `defaultTheme(kind)` picks by DevTools kind; this is "auto" for a future VS Code-style picker (multiple light/dark themes, persisted choice). Adding a theme is one entry in `themes`.
- `main.tsx` `applyTheme(theme)`: sets `themeVars(theme)` (`--theme-<token>`) on `<html>`, plus `data-theme=<id>` and `data-theme-kind=<kind>`.
- `index.css` `@theme inline` maps Tailwind colors (`bg-bg`, `text-fg`, `border-border`, ...) to `--theme-*`. Components use tokens only, never a theme name. Biome needs `css.parser.tailwindDirectives` for this.
- Kind source: `getTheme()` (`themeName === "dark"`) at load; `onThemeChanged` in Firefox only. Chrome has no theme event, and its panel iframe's `prefers-color-scheme` flips during load (observed in e2e), so it can't stand in for one: Chrome keeps the load-time theme until the panel reopens.

## E2E harness (`e2e/harness.ts`)

- `rows()` reads `[role="option"]` text. `press(key)` focuses the listbox and dispatches `keydown`; `select(row)` clicks the option with that text; `selectedRow()` requires `aria-activedescendant` to match; `activeTab()`, `detail()` (tabpanel text or `null`).
- `openPanel({ devtoolsTheme })` writes DevTools' `ui-theme` into `<userDataDir>/Default/Preferences` before launch: headless DevTools ignores emulated color schemes. `themeKind()`, `devtoolsTheme()` (DevTools `theme-with-dark-background` class), `cssVar(name)`.

## Key files

- `src/panel/main.tsx`, `src/panel/app.tsx`, `src/panel/list.tsx`, `src/panel/detail.tsx`
- `src/panel/keys.ts`, `src/panel/summary.ts`, `src/panel/themes.ts` (+ `.test.ts`)
- `src/panel/index.css`
- `e2e/harness.ts`, `e2e/panel.test.ts`

## Related

- `docs/capture.md`: store, entries, preserve log.
- `docs/decoders.md`: where `decoded` comes from.
- `docs/overview.md`
