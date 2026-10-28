# Build

## Scripts

- `pnpm build`: `vite build --mode chrome && vite build --mode firefox`. Outputs `dist/chrome/` and `dist/firefox/`.
- `pnpm lint`: `biome check .` (respects `.gitignore`).
- `pnpm typecheck`: `tsc --noEmit`.
- `pnpm test`: `vitest run`. Unit tests only; `e2e/**` excluded in `vitest.config.ts`.
- `pnpm e2e`: `vite build --mode chrome`, then Vitest with `vitest.e2e.config.ts` (`e2e/**/*.test.ts`, 30s timeout).

## Targets

- Vite `mode` is the browser target; any other mode throws in `vite.config.ts`.
- Two HTML entries: `devtools.html` (devtools page, registers the panel) and `panel.html` (Solid UI).
- `public/` (icon) is copied verbatim into each target dir, so no build-only files go there.
- Module preload polyfill disabled: both browsers support it natively.
- Panel bundle budget: 40960 bytes, `gzip -9c dist/chrome/assets/panel-*.js | wc -c`. Enforced by `pnpm release` (`PANEL_BUDGET` and `panelOverBudget` in `scripts/budget.ts`, gzip level 9) and checked in each spec's last task. Raised from 24576 to 32768 for M5's binary decoders and schemas, then to 40960 for M6 (filters, body search, Copy as, diff, HAR export and redaction). The lazy `proto-schema-*.js` chunk (`.proto` parser and typed reader, loaded on first use) is outside the budget.

## Manifests

- Generated, not checked in. `manifestPlugin` emits `manifest.json` per target from `manifestFor(target, version)`.
- Version comes from `package.json`.
- `name` and `description` are the Chrome Web Store title (max 75 chars) and summary (max 132), the fields its search weighs most; `scripts/build-manifests.test.ts` checks the limits. Write the summary as a sentence, not a protocol list: v1.0.0 was rejected for "excessive keywords" (Yellow Argon) over a comma list of seven formats. The DevTools tab title is separate (`createPanel("SnapQL", ...)` in `src/devtools.ts`). The long description lives in `store/listing.txt`, plain text (the dashboard shows Markdown literally).
- Firefox adds `browser_specific_settings.gecko`:
  - `id: "snapql@akshay-xp"`: provisional until an AMO account exists.
  - `data_collection_permissions: { required: ["none"] }`: required for new AMO extensions.
- Validate the Firefox build with `pnpm dlx web-ext lint -s dist/firefox`.

## Loading locally

- Chrome: `chrome://extensions`, Developer mode, Load unpacked, `dist/chrome`.
- Firefox: `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, `dist/firefox/manifest.json`.

## E2E

- Chromium only. Firefox e2e deferred (not automatable).
- `e2e/harness.ts` exposes one function, `openPanel()`, returning `{ page, origin, rows(), clear(), togglePreserveLog(), close() }` plus selection, detail and theme helpers (see `docs/panel.md`).
- How it works:
  - `node:http` test server on port 0: `/` is a page that fetches `GET /api/one` then `POST /api/two` (200, 201).
  - Playwright `launchPersistentContext` (`channel: "chromium"`, headless) loads `dist/chrome` with `--auto-open-devtools-for-tabs` and `--remote-debugging-port=0`.
  - Real port read from `<userDataDir>/DevToolsActivePort`; no port collisions.
  - Small CDP client (`Runtime.evaluate` over WebSocket) on the `devtools://` target finds the tab id containing `SnapQL` and shows it; a second client on the `/panel.html` target reads `li` text and clicks Clear.
- Relies on DevTools internals: `ui/legacy/legacy.js`, `InspectorView.instance()`, `tabbedPane.tabIds()`, `showPanel(id)`. A Playwright (bundled Chromium) upgrade can break it; fix the harness, not the tests.
- No fixed sleeps: tests wait with `expect.poll`, harness with its internal `poll` helper (the only `setTimeout`).
- Test server also serves `/other` (fetches `/api/three`) for navigation tests; `togglePreserveLog()` clicks the panel's Preserve log checkbox.
- `openPanel({ visitFirst: true })` loads the test page after DevTools is up but before the panel is shown (backfill test). DevTools must be loaded first or it records nothing.
- `openPanel({ server })`: a `node:http` `Server` not yet listening (started on port 0, closed by `close()`; attach a `WebSocketServer` first if needed), or `{ origin }` of a server the caller runs (left alone). Default: the test server.
- `openPanel({ size: { width, height } })` (store screenshots): DevTools docked at the bottom with its area exactly `size` CSS px.
  - Presets `currentDockState: "bottom"` and `inspector-view.split-view-state` (horizontal size twice the height) in the profile's DevTools preferences, merged with `devtoolsTheme`'s `ui-theme`. Asking for exactly the height gives 1px less (the resizer).
  - Launches with Playwright `viewport: null` (else the window is pinned to the default viewport) and `--window-size`.
  - Chrome keeps a ~151px page strip above a bottom dock, and it rounds, so the harness measures `InspectorView` and grows the window with `Browser.setWindowBounds` (integer bounds, deficits rounded up) until the area is `size` to under 1px over. The Browser domain needs `context.newCDPSession(page)`: the DevTools target's own socket refuses it.
  - `deviceScaleFactor` (listing captures): adds `--force-device-scale-factor`, so DevTools renders natively at that density. The rect then moves in fractions (one window step is 0.8 CSS px at 1.25), which is why the loop accepts under 1px over instead of exact.
  - Without `size`, DevTools stays docked right at the default window size, as every test expects.
- `screenshot(file)` captures the DevTools window clipped to the `InspectorView` rect, so a bottom dock's blank page strip is left out. With `size` the clip is exactly `size` and its origin is snapped to a whole device pixel (a half-pixel origin blurs the capture), so the image is `size × deviceScaleFactor`.
- `e2e/fixtures/glyph.ttf`: made for this repo with fontTools `FontBuilder` (`.notdef` and a square `A`, 1000 upm, family `SnapQL Glyph`); a font the Body preview can load, since CI has no system fonts to borrow. Regenerate the same way if it ever needs to change.
- Rows include the document and favicon requests, so assert with `arrayContaining` unless the panel was just cleared.

## Release

- `pnpm release`: `vite build --mode chrome`, then `node scripts/release.ts` (Node runs the `.ts` directly; 22.18+ strips types unflagged). Exits 1 with `<file> is <n> bytes gzipped, over the 40960 budget` when the panel is too big; otherwise writes `release/snapql-chrome-<version>.zip` (gitignored, replaced on rerun) by running `zip -qrX` inside `dist/chrome`, so `manifest.json` is at the zip root as the store requires. Vite empties `dist/chrome` per build, so no stale files ship.
- Steps:
  1. Set `version` in `package.json` (the manifests take it from there).
  2. `pnpm release`.
  3. Merge to `master`, then tag it: `git tag v<version> && git push origin v<version>`.
  4. `gh release create v<version> release/snapql-chrome-<version>.zip --title v<version> --notes "<what changed>"`.
  5. Chrome Web Store developer dashboard, SnapQL item:
     - Package: upload the zip.
     - Store listing: paste `store/listing.txt` as the description; replace the screenshots with `store/listing-images/*.png` in file order; promo tiles: `store/promo/small.png` (440x280) and `store/promo/marquee.png` (1400x560). Title and summary come from the manifest (`name`, `description`), not the dashboard.
     - Test instructions (Distribution / reviewer notes): paste `store/test-instructions.txt` (field limit 500 chars). Reviewers run no scripts: the example, countries.trevorblades.com (a public GraphiQL page), sends an introspection query on load, so a reload shows a decoded GraphQL row. Recheck it before each submission.
     - Privacy practices: paste the sections of `store/privacy.txt` (single purpose, permission justification, remote code, data usage) into their fields.
     - Submit for review.
- Firefox is built but not published; AMO submission is out of scope until it is.

## Store screenshots

- `pnpm screenshots`: `vite build --mode chrome`, then Vitest with `vitest.store.config.ts` (include `store/screenshots.ts`, 60s timeout). Writes the raw shots to `store/screenshots/` (1280x800, used by the README) and 1.25x copies to `store/captures/` (1600x1000, a second session with `openPanel({ deviceScaleFactor: 1.25 })`, which launches with `--force-device-scale-factor`; CDP's `clip.scale` only stretches a 1x render and blurs), both committed, in listing order: `1-graphql`, `2-grpc`, `3-websocket`, `4-llm-stream`, `5-search`. About 14s (each shot opens twice).
- Not run in CI (slow to review, and the shots only change with the UI); `tsc` and lint cover `store/`. `store/screenshots.ts` is not a `*.test.ts`, so `pnpm test` skips it.
- Each shot: `openPanel({ server: demoServer(), size: 1280x800, devtoolsTheme: "dark" })`, a setup that polls for the shot's key text (`Decoded · graphql`, `Decoded · grpc-web · OK` and `"IN_STOCK"`, `Message 7`, `Decoded · llm · tool_calls`, a body `mark`), `screenshot()`, then an IHDR check for exactly 1280x800. A render that never arrives fails the run instead of writing a blank image.
- Shots stay on Payload, Response and Messages, never Summary, so the `127.0.0.1:<port>` origin doesn't show; rows show only paths and operation names.
- `store/demo.ts` (`demoServer()`, an unstarted `Server` with a `WebSocketServer`): a fictional travel app, Wayfare (no real companies or people). `/` fires GraphQL operations (`SearchFlights`, `GetTrips`, a batch, a persisted query, a mutation) plus a JSON and a form request; `/grpc` calls `catalog.ProductService` (`CATALOG_PROTO`, added as a schema so fields are named; replies built by a small protobuf writer); `/chat` exposes `start()` (called once the probe is in) to open the `/chat` socket; `/assistant` streams an OpenAI-style `demo-chat-1` reply with a `search_flights` tool call and usage. Ack ids are a counter, so reshoots match.
- Retake after UI changes: `pnpm screenshots`, then `pnpm listing-images`, look at each PNG, commit.

## Store listing images

- What the store shows: `store/listing-images/*.png`, 1280x800, a headline and subline over a crop of each `store/captures/` shot drawn 1:1 (any resampling, such as shrinking a 2x capture, blurs the panel text), in the icon's style (`#dcdbd9` ground, faint 20/80px grid, `#262626` ink, orange stepped trace; design notes in the local, gitignored `design/SOCIAL.md`).
- `pnpm listing-images`: `node store/listing-images.ts` opens `store/listing-image.html` once per shot in Playwright Chromium, passing capture, headline, subline, crop origin (1x px, multiples of 4 so the 1.25x offset is a whole pixel) and `01 / 05` index in the query string, then screenshots 1280x800. Copy and crops live in `shots` in that script. IBM Plex comes from Google Fonts, so it needs network.
- Crops start at x 0 when the row names matter (GraphQL, gRPC, search) and x 292 when the detail pane does (WebSocket messages, LLM reply); at 1.25x only 960 source px fit.
- Promo tiles: the same script then opens `store/promo-tile.html?kind=small|marquee` and writes `store/promo/small.png` (440x280: mark left, name and tagline right) and `store/promo/marquee.png` (1400x560: name, tagline and protocol list left, mark right). The mark is the icon's art placed by a transform (`layouts` in the HTML: scale and bracket centre), with its orange slash run past the tile's top and bottom.

## CI

- `.github/workflows/ci.yml`: one `ci` job on push and PR to `master`.
- Steps: `pnpm install --frozen-lockfile`, then `lint`, `typecheck`, `test`, `build`, Chromium, `e2e` as separate steps; first failure fails the job.
- Chromium: `~/.cache/ms-playwright` cached by `actions/cache`, keyed on `playwright --version`; `playwright install chromium` only on a miss. No `--with-deps`: its apt step took 9+ min on a slow mirror (PR #64) while the browser download takes seconds, and the runner image already ships Chrome's system libraries. `Check Chromium libraries` runs `ldd` on both binaries and fails listing any `not found`, so a runner image change shows up as a clear error rather than a browser launch failure.
- Node 22: the `engines` minimum, so CI catches use of newer Node APIs.
- pnpm version comes from `packageManager` in `package.json` (read by `pnpm/action-setup`); not repeated in the workflow.
- Validate locally: `pnpm dlx @action-validator/cli .github/workflows/ci.yml`.

## Key files

- `vite.config.ts`: target selection, plugins, entries.
- `.github/workflows/ci.yml`: CI.
- `e2e/harness.ts`, `e2e/panel.test.ts`, `vitest.e2e.config.ts`: e2e.
- `scripts/build-manifests.ts`: manifest base, per-target diff, Vite plugin.
- `scripts/build-manifests.test.ts`: manifest tests.
- `src/browser/devtools.ts`: browser adapter.
- `src/devtools.ts`: devtools page entry.
- `src/panel/`: panel UI.

## Related

- `docs/overview.md`
