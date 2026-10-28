import { mkdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium, type Page } from "playwright"

// The store's images: the captioned 1280x800 screenshots (a headline over a
// crop of each 1.25x capture from `pnpm screenshots`) and the small and
// marquee promo tiles. Run with
// `pnpm listing-images`; fonts come from Google Fonts, so it needs network.

type Shot = {
  capture: string
  headline: string
  subline: string
  // Crop origin in 1x screenshot pixels, multiples of 4 so the 1.25x offset
  // is a whole pixel.
  x: number
  y: number
}

const shots: Shot[] = [
  {
    capture: "1-graphql",
    headline: "GraphQL, by operation name",
    subline: "Queries, variables, batches and persisted queries, decoded.",
    x: 0,
    y: 72,
  },
  {
    capture: "2-grpc",
    headline: "gRPC-web you can read",
    subline:
      "Protobuf decoded without a schema. Add your .proto files for field names.",
    x: 0,
    y: 72,
  },
  {
    capture: "3-websocket",
    headline: "Every WebSocket frame, decoded",
    subline: "Socket.IO, graphql-ws and plain JSON messages, one row each.",
    x: 292,
    y: 72,
  },
  {
    capture: "4-llm-stream",
    headline: "LLM streams, put back together",
    subline:
      "The reply, tool calls and token usage from OpenAI and Anthropic streams.",
    x: 292,
    y: 100,
  },
  {
    capture: "5-search",
    headline: "Find the request you want",
    subline: "Search names, URLs and bodies. Filter by protocol and status.",
    x: 0,
    y: 32,
  },
]

const tiles = [
  { kind: "small", width: 440, height: 280 },
  { kind: "marquee", width: 1400, height: 560 },
]

const store = import.meta.dirname
const out = resolve(store, "listing-images")
const promo = resolve(store, "promo")
const template = pathToFileURL(join(store, "listing-image.html"))
const tileTemplate = pathToFileURL(join(store, "promo-tile.html"))

async function render(page: Page, url: URL, path: string) {
  await page.goto(url.href, { waitUntil: "networkidle" })
  await page.evaluate("document.fonts.ready")
  await page.screenshot({ path })
}

await mkdir(out, { recursive: true })
await mkdir(promo, { recursive: true })
const browser = await chromium.launch({ channel: "chromium" })
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })
  for (const [i, shot] of shots.entries()) {
    const url = new URL(template)
    const index = `${String(i + 1).padStart(2, "0")} / ${String(shots.length).padStart(2, "0")}`
    for (const [key, value] of Object.entries({ ...shot, index })) {
      url.searchParams.set(key, String(value))
    }
    await render(page, url, join(out, `${shot.capture}.png`))
  }
  for (const { kind, width, height } of tiles) {
    await page.setViewportSize({ width, height })
    const url = new URL(tileTemplate)
    url.searchParams.set("kind", kind)
    await render(page, url, join(promo, `${kind}.png`))
  }
} finally {
  await browser.close()
}
