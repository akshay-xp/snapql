# Site

Landing page at https://snapql.akxp.net, in `apps/site/` (paths below are relative to it). Design source of truth: the "SnapQL site" Design canvas (claude.ai artifact, artboard `project/Main.dc.html`); match it section by section.

## Structure

- Astro, static output, no UI framework, no Tailwind (one page; the canvas is plain CSS).
- `astro.config.mjs`: `site: "https://snapql.akxp.net"`.
- `src/pages/index.astro`: the page, composed from section components.
- `src/layouts/Base.astro`: `<html lang="en">`, title `SnapQL: network traffic in DevTools, made readable`, meta description, favicon (`public/favicon.png`, a copy of the extension's `128.png`), fonts, `global.css`, then `Nav`, `<main id="top">`, `Footer`.
- `src/styles/global.css`: the canvas tokens (`--ground`, `--ink`, `--muted`, `--rule`, `--signal`, `--night*`, `--sans`, `--mono`), the 20/80px grid background on `body`, `.wrap` (1280px max, 40px gutters, 20px under 480px), `.mono`, `.label`, focus outline in `--signal`.
- `src/components/`: `Mark` (the icon's brackets and orange slash, `size` prop), `Nav` (links hidden under 480px), `Footer` (version read from `apps/extension/package.json`). Section components keep their styles scoped.
- No licence anywhere on the site (design decision).

## Build

- `pnpm --filter site build` (also run by the root `pnpm build`) writes `dist/`.
- Fonts: IBM Plex Sans 400/500/600 and Mono 400/500 from `@fontsource`, bundled into `dist/_astro/`; the page makes no third-party requests.
- Versions pinned exactly (`astro`, `wrangler`, `@fontsource/*`), each at least two weeks old when added.
- `pnpm typecheck` runs `tsc --noEmit` over `e2e/` and the configs: `astro check` refuses TypeScript 7, which the repo uses. `.astro` files are covered by the build and the e2e test.
- Lint: the root Biome config has an override for `**/*.astro` turning off `noUnusedVariables` and `noUnusedImports` (it doesn't see frontmatter used by the template). `.astro/` (generated types) is gitignored.

## Tests

- `pnpm --filter site e2e`: `astro build`, then Vitest with `vitest.e2e.config.ts` (`e2e/**/*.test.ts`, 30s timeout).
- `openSite()` in `e2e/site.test.ts` returns `{ page, offsite, close() }`: Playwright Chromium opens `https://snapql.test/`, and `page.route("**/*")` serves `dist/` for that origin (`/` and directory paths as `index.html`) and aborts every other request, recording its URL in `offsite`.
- Fonts are checked with `document.fonts.load()` (resolves to the faces it loaded), not `document.fonts.check()`, which is true when no `@font-face` matches at all.

## Deploy

- `.github/workflows/site.yml`: on push to `master` touching `apps/site/**`, `apps/extension/store/captures/**`, `apps/extension/package.json`, `pnpm-lock.yaml` or the workflow, and on manual dispatch. Installs, `pnpm --filter site build`, then `wrangler pages deploy dist --project-name snapql --branch master`.
- Secrets: `CLOUDFLARE_API_TOKEN` (Cloudflare Pages edit permission) and `CLOUDFLARE_ACCOUNT_ID`, as GitHub repository secrets.
- One-time setup, by hand: create the Pages project `snapql` (`pnpm --filter site exec wrangler pages project create snapql --production-branch master`, or in the dashboard), add the two secrets, then attach the custom domain `snapql.akxp.net` to the project in the Cloudflare dashboard.
