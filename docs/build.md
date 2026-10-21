# Build

## Scripts

- `pnpm build`: `vite build --mode chrome && vite build --mode firefox`. Outputs `dist/chrome/` and `dist/firefox/`.
- `pnpm lint`: `biome check .` (respects `.gitignore`).
- `pnpm typecheck`: `tsc --noEmit`.
- `pnpm test`: `vitest run`.

## Targets

- Vite `mode` is the browser target; any other mode throws in `vite.config.ts`.
- Two HTML entries: `devtools.html` (devtools page, registers the panel) and `panel.html` (Solid UI).
- `public/` (icon) is copied verbatim into each target dir, so no build-only files go there.
- Module preload polyfill disabled: both browsers support it natively.

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

## Key files

- `vite.config.ts`: target selection, plugins, entries.
- `scripts/build-manifests.ts`: manifest base, per-target diff, Vite plugin.
- `scripts/build-manifests.test.ts`: manifest tests.
- `src/browser/devtools.ts`: browser adapter.
- `src/devtools.ts`: devtools page entry.
- `src/panel/`: panel UI.

## Related

- `docs/overview.md`
