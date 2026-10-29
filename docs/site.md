# Site

Landing page at https://snapql.akxp.net, in `apps/site/` (paths below are relative to it). Design source of truth: the "SnapQL site" Design canvas (claude.ai artifact, artboard `project/Main.dc.html`); match it section by section.

## Structure

- Astro, static output, no UI framework, no Tailwind (one page; the canvas is plain CSS).
- `astro.config.mjs`: `site: "https://snapql.akxp.net"`.
- `src/pages/index.astro`: the page, composed from section components.
- `src/pages/404.astro`: the not-found page. Cloudflare Pages serves `404.html` with a 404 status for unknown paths; without it Pages falls back to `index.html` with a 200 (soft 404s; `/robots.txt`, `/llms.txt` and `/.well-known/ard.json` served as HTML, which fails Lighthouse's SEO and agentic checks instead of skipping them). Nav links are root-relative (`/#workspaces`) so they work from it.
- `public/robots.txt` and `public/sitemap.xml` (one URL, hand-written: a single page needs no sitemap integration). Search consoles take the sitemap URL.
- `src/layouts/Base.astro`: `<html lang="en">`, title (default `SnapQL: network traffic in DevTools, made readable`, `title` prop for the 404), meta description, canonical link from `site` (snapql.pages.dev serves a duplicate copy), favicon (`public/favicon.png`, a copy of the extension's `128.png`), fonts, `global.css`, then `Nav`, `<main id="top">`, `Footer`.
- `src/styles/global.css`: the canvas tokens (`--ground`, `--ink`, `--muted`, `--rule`, `--signal`, `--night*`, `--sans`, `--mono`), the 20/80px grid background on `body` (a flex column at least the window's height, `main` grows, so short pages keep the footer at the bottom), `.wrap` (1280px max, 40px gutters, 20px under 480px), `.mono`, `.label`, focus outline in `--signal`.
- `src/components/`: `Mark` (the icon's brackets and orange slash, `size` prop), `Nav` (links hidden under 480px), `Footer` (version read from `apps/extension/package.json`). Section components keep their styles scoped.
- No licence anywhere on the site (design decision).
- One orange, `--signal` (`#ff4419`), on light and dark alike: SVG lines take it through the global `.signal` class; it passes as text on the dark band (4.8:1), and where it wouldn't (orange text on `#3a3a3a`) an orange mark is used instead. The e2e test fails on any other orange.
- Hero carousel (`Hero.astro`): autoplays one slide per `--slide` (6s), looping. The active tab's `.tab-fill` animates `scaleX(0 → 1)`; its `animationend` advances the slide, so the bar and the timer can't drift. Paused (`animation-play-state`) on hover, keyboard focus (`:focus-visible`, so a mouse click doesn't stop it) and while off screen (`data-paused`, IntersectionObserver). The pause rule uses the animation's own selector: the `animation` shorthand resets the play state, so a less specific rule loses. No autoplay with `prefers-reduced-motion` (the active bar shows full) or without JS (the GraphQL shot stays).

## Build

- `pnpm --filter site build` (also run by the root `pnpm build`) writes `dist/`.
- `build.inlineStylesheets: "always"`: the one small stylesheet goes inline, so it doesn't block the first paint.
- Screenshots: `widths={[800, 1200, 1600]}` with `sizes` for their rendered width, so phones get the 800px file.
- Fonts: IBM Plex Sans 400/500/600 and Mono 400/500 from `@fontsource`, bundled into `dist/_astro/`; the page makes no third-party requests. (On snapql.akxp.net, Cloudflare's Web Analytics beacon is injected by the akxp.net zone, not the build.)
- Versions pinned exactly (`astro`, `sharp`, `@fontsource/*`), each at least two weeks old when added. Wrangler is not a dependency: the deploy job pins it (below).
- `pnpm typecheck` runs `tsc --noEmit` over `e2e/` and the configs: `astro check` refuses TypeScript 7, which the repo uses. `.astro` files are covered by the build and the e2e test.
- Lint: the root Biome config has an override for `**/*.astro` turning off `noUnusedVariables` and `noUnusedImports` (it doesn't see frontmatter used by the template). `.astro/` (generated types) is gitignored.

## Tests

- `pnpm --filter site e2e`: `astro build`, then Vitest with `vitest.e2e.config.ts` (`e2e/**/*.test.ts`, 30s timeout). The root `pnpm e2e` runs it alongside the extension's, so CI's E2E step covers the site.
- `openSite()` in `e2e/site.test.ts` returns `{ page, offsite, close() }`: Playwright Chromium opens `https://snapql.test/`, and `page.route("**/*")` serves `dist/` for that origin (`/` and directory paths as `index.html`) and aborts every other request, recording its URL in `offsite`.
- `openSite()` options: `viewport`, `javaScriptEnabled` (the no-JS switcher check) and `path` (e.g. `/#privacy`).
- Helpers: `textOf` (text with source whitespace collapsed), `partsOf` (an element's children joined with spaces; flex items have none between them in `textContent`), `links` (text and href pairs), `box`, `contentBox` and `fillsContent` (an item spans its container's content width, the phone stacking check), `scrollWidth` (sideways scroll), `navLandsOn` (a nav link scrolls its section to the top), `landedOn` (top reached, or scrolled to the bottom with the whole section in view: Privacy is too short to reach the top), `scrollThrough` (scrolls the page so lazy images load, then waits for the shown ones).
- Every section checks its copy, its layout at 1440x900 and its stacking at 390x844. The last test scrolls the whole page and opens every hero tab, then asserts `offsite` is empty.
- The binary samples on the decode cards (gRPC-web, JWT, MessagePack) are decoded by small inline decoders in the test and compared with what each card shows, so a copy edit can't make a card wrong.
- Carousel tests shorten `--slide` with `setSlide()`. Shrinking it below the time already played ends the fill at once, paused or not, so pause tests keep the slide longer than their setup.
- Fonts are checked with `document.fonts.load()` (resolves to the faces it loaded), not `document.fonts.check()`, which is true when no `@font-face` matches at all.

## Deploy

- `.github/workflows/site.yml`, the same shape as distillate's `docs.yml`: on push to `master` touching `apps/site/**`, `apps/extension/store/captures/**`, `apps/extension/package.json`, `pnpm-lock.yaml` or the workflow, and on manual dispatch. Not on pull requests: CI's root build and e2e already cover the site.
  - `build`: install, `pnpm --filter site build`, upload `apps/site/dist/` as the `site-dist` artifact.
  - `deploy` (needs `build`, only on `refs/heads/master`): downloads the artifact and runs `cloudflare/wrangler-action` with `wranglerVersion` `4.151.0` and `packageManager: npm`, command `pages deploy apps/site/dist --project-name=snapql --branch=master`. No checkout, so wrangler-action can't infer pnpm from the lockfile. It deploys exactly what `build` produced.
  - `concurrency` per workflow and ref, `cancel-in-progress`: a newer push supersedes an older deploy.
  - Every action is pinned to a commit SHA (version in a comment), as in `ci.yml`, since this workflow holds a token that can publish the site.
- Secrets: `CLOUDFLARE_API_TOKEN` (Cloudflare Pages edit permission) and `CLOUDFLARE_ACCOUNT_ID`, as GitHub repository secrets.
- One-time setup, by hand: create the Pages project `snapql` (`pnpm dlx wrangler@4.151.0 pages project create snapql --production-branch master`, or in the dashboard), add the two secrets, then attach the custom domain `snapql.akxp.net` to the project in the Cloudflare dashboard.
