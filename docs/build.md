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
- Panel bundle budget: 40960 bytes, `gzip -9c dist/chrome/assets/panel-*.js | wc -c`. Not enforced by a script; checked in each spec's last task. Raised from 24576 to 32768 for M5's binary decoders and schemas, then to 40960 for M6 (filters, body search, Copy as, diff, HAR export and redaction). The lazy `proto-schema-*.js` chunk (`.proto` parser and typed reader, loaded on first use) is outside the budget.

## Manifests

- Generated, not checked in. `manifestPlugin` emits `manifest.json` per target from `manifestFor(target, version)`.
- Version comes from `package.json`.
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
- `e2e/fixtures/glyph.ttf`: made for this repo with fontTools `FontBuilder` (`.notdef` and a square `A`, 1000 upm, family `SnapQL Glyph`); a font the Body preview can load, since CI has no system fonts to borrow. Regenerate the same way if it ever needs to change.
- Rows include the document and favicon requests, so assert with `arrayContaining` unless the panel was just cleared.

## CI

- `.github/workflows/ci.yml`: one `ci` job on push and PR to `master`.
- Steps: `pnpm install --frozen-lockfile`, then `lint`, `typecheck`, `test`, `build`, `playwright install --with-deps chromium`, `e2e` as separate steps; first failure fails the job.
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
