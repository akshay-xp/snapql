# SnapQL overview

DevTools extension that makes network traffic human readable. v0.2.0 (live on the Chrome Web Store) inspected GraphQL only; the rewrite generalizes it to all kinds of network traffic.

## Stack

- Solid (only runtime dependency) + Tailwind v4, built with Vite.
- Biome for lint/format, Vitest for tests, TypeScript strict.

## Targets

- Chrome: built and published.
- Firefox: built and kept working, not published.

## Invariants

1. Only `src/browser/` touches `chrome.*`.
2. Capture/store code has no UI imports and runs in Vitest without a browser.
3. Response bodies load only on demand.
4. The entry store is capped; oldest entries evicted first.
5. No runtime dependencies beyond Solid without explicit justification.

## Roadmap

GitHub milestones M0 (foundation) to M7 (1.0 release).

## Docs

- `docs/build.md`: scripts, manifests, per-browser output.
