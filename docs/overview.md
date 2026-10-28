# SnapQL overview

DevTools extension that makes network traffic human readable. v0.2.0 (live on the Chrome Web Store) inspected GraphQL only; the rewrite generalizes it to all kinds of network traffic.

## Stack

- Solid (only runtime dependency) + Tailwind v4, built with Vite.
- Biome for lint/format, Vitest for tests, TypeScript strict.

## Layout

- pnpm workspace (`pnpm-workspace.yaml`: `apps/*`). Run every script from the root; see `docs/build.md`.
- Root: shared config only: `biome.json` (lint and format for the whole repo), `tsconfig.base.json` (each app's `tsconfig.json` extends it), `docs/`, `.github/`, `README.md`, `LICENSE`.
- `apps/extension/`: the extension (this overview, `docs/build.md`, `capture.md`, `decoders.md`, `panel.md`; their paths are relative to it).

## Targets

- Chrome: built and published.
- Firefox: built and kept working, not published.

## Invariants

1. Only `src/browser/` touches `chrome.*`.
2. Capture/store code has no UI imports and runs in Vitest without a browser.
3. API (XHR/fetch) response bodies are read as requests finish, before Chrome drops them; other bodies load only on demand, or for every entry while body search is on.
4. The entry store is capped; oldest entries evicted first.
5. No runtime dependencies beyond Solid without explicit justification.
6. Decoders read only the request side and run once per entry, at capture.
7. The page probe (`src/probe/probe.js`) ships verbatim, runs only while the panel is open, only records, and needs no permissions.

## Roadmap

GitHub milestones M0 (foundation) to M7 (1.0 release).

## Docs

- `docs/build.md`: scripts, manifests, per-browser output.
- `docs/capture.md`: entry model, capped store, lazy bodies.
- `docs/decoders.md`: decoder contract, registry, GraphQL rules.
- `docs/panel.md`: layout, keyboard map, detail pane, themes.

## Store

- `apps/extension/store/`: Chrome Web Store material, never bundled: `listing.txt` (long description), `privacy.txt` (privacy practices answers), `test-instructions.txt` (for store reviewers), `screenshots/` and `captures/` (scripted shots, 1x and 1.25x), `listing-images/` (the captioned images the store shows), `promo/` (small and marquee tiles), `demo.ts`, `screenshots.ts`, `listing-images.ts`, `listing-image.html` and `promo-tile.html` (how they are made). See `docs/build.md`.
- `design/` (gitignored, local only): visual references, social card direction and the icon's SVG sources (`design/icon/`), from which `public/128.png` is exported.
