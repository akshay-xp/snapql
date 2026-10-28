import { readFile } from "node:fs/promises"
import { extname, join, resolve } from "node:path"
import { chromium, type Page } from "playwright"
import { expect, test } from "vitest"

const dist = resolve(import.meta.dirname, "../dist")
const origin = "https://snapql.test"
const types: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
}

// Serves dist/ at a made-up origin; any other request is aborted and kept in
// `offsite`, so tests can prove the page never leaves its own origin.
async function openSite(
  options: {
    viewport?: { width: number; height: number }
    javaScriptEnabled?: boolean
  } = {},
): Promise<{
  page: Page
  offsite: string[]
  close(): Promise<void>
}> {
  const browser = await chromium.launch()
  const page = await (await browser.newContext(options)).newPage()
  const offsite: string[] = []
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) {
      offsite.push(url.href)
      return route.abort()
    }
    const path = url.pathname.endsWith("/")
      ? `${url.pathname}index.html`
      : url.pathname
    try {
      const body = await readFile(join(dist, decodeURIComponent(path)))
      await route.fulfill({
        body,
        contentType: types[extname(path)] ?? "application/octet-stream",
      })
    } catch {
      await route.fulfill({ status: 404 })
    }
  })
  await page.goto(`${origin}/`)
  return { page, offsite, close: () => browser.close() }
}

const extensionVersion = async (): Promise<string> =>
  JSON.parse(
    await readFile(
      resolve(import.meta.dirname, "../../extension/package.json"),
      "utf8",
    ),
  ).version

// Text as a visitor reads it: whitespace from source formatting collapsed.
const textOf = (page: Page, selector: string) =>
  page.$eval(selector, (e) => e.textContent?.replace(/\s+/g, " ").trim())

const links = (page: Page, selector: string) =>
  page.$$eval(`${selector} a`, (as) =>
    as.map((a) => [a.textContent?.trim(), a.getAttribute("href")]),
  )

test("nav and footer link where the design says, with no licence", async () => {
  const version = await extensionVersion()
  const { page, close } = await openSite()
  try {
    expect(await links(page, "nav .nav-links")).toEqual([
      ["Workspaces", "#workspaces"],
      ["Formats", "#formats"],
      ["Quick start", "#start"],
      ["Privacy", "#privacy"],
      ["GitHub", "https://github.com/akshay-xp/snapql"],
    ])
    expect(await page.getAttribute("nav > a", "href")).toBe("#top")
    expect(await links(page, "footer")).toEqual([
      [
        "Chrome Web Store",
        "https://chromewebstore.google.com/detail/bopfjlgmfhmpnceeknaddfgeanchkbmm",
      ],
      ["GitHub", "https://github.com/akshay-xp/snapql"],
      ["Report an issue", "https://github.com/akshay-xp/snapql/issues"],
    ])
    expect(await page.textContent("footer")).toContain(
      `v${version} · by akshay-xp`,
    )
    const text = await page.textContent("body")
    expect(text).not.toMatch(/GPL/)
    expect(text).not.toMatch(/licen[cs]e/i)
  } finally {
    await close()
  }
})

test("IBM Plex loads from the site itself", async () => {
  const { page, offsite, close } = await openSite()
  try {
    // load() resolves to the faces it loaded: none when no @font-face matches.
    const loaded = await page.evaluate(async () =>
      Promise.all(
        ['600 16px "IBM Plex Sans"', '500 13px "IBM Plex Mono"'].map(
          async (font) => (await document.fonts.load(font)).length,
        ),
      ),
    )
    expect(loaded).toEqual([1, 1])
    expect(offsite).toEqual([])
  } finally {
    await close()
  }
})

test("the page has its title and language", async () => {
  const { page, close } = await openSite()
  try {
    expect(await page.title()).toBe(
      "SnapQL: network traffic in DevTools, made readable",
    )
    expect(await page.getAttribute("html", "lang")).toBe("en")
  } finally {
    await close()
  }
})

test("the hero says what SnapQL is and links to the store", async () => {
  const version = await extensionVersion()
  const { page, close } = await openSite()
  try {
    const text = (selector: string) => textOf(page, selector)
    expect(await text(".hero h1")).toBe(
      "Network traffic in DevTools, made readable.",
    )
    expect(await text(".hero .label")).toBe(
      `Chrome DevTools extension · v${version}`,
    )
    expect(await text(".hero .subtitle")).toBe(
      "A DevTools tab that names each request by what it does and decodes what it carries.",
    )
    expect(await links(page, ".hero .actions")).toEqual([
      [
        "Add to Chrome, it's free",
        "https://chromewebstore.google.com/detail/bopfjlgmfhmpnceeknaddfgeanchkbmm",
      ],
      ["View source on GitHub", "https://github.com/akshay-xp/snapql"],
    ])
    expect(await text(".hero .meta")).toBe(
      "No permissions needed · Your traffic stays in your browser · Free and open source",
    )
  } finally {
    await close()
  }
})

const tabs = [
  [
    "GraphQL",
    "Operations by name, with query and variables decoded",
    "SnapQL listing GraphQL",
  ],
  ["gRPC-web", "Messages decoded, fields named from your .proto", "A gRPC-web"],
  [
    "WebSocket",
    "Every frame of a connection, listed and decoded",
    "A WebSocket",
  ],
  [
    "LLM stream",
    "Reply, tool calls and token usage, reassembled",
    "An LLM chat stream",
  ],
  [
    "Search",
    "Find a request by name, URL or body text",
    "Searching request bodies",
  ],
]

// Alt text of every shot the visitor can see.
const visibleShots = (page: Page) =>
  page.$$eval(".shots img", (imgs) =>
    imgs
      .filter((img) => (img as HTMLElement).offsetParent !== null)
      .map((img) => img.getAttribute("alt") ?? ""),
  )

test("each hero tab shows its own screenshot", async () => {
  const { page, close } = await openSite()
  try {
    expect(
      await page.$$eval(".tabs button", (bs) =>
        bs.map((b) => [
          b.querySelector(".tab-label")?.textContent?.trim(),
          b.querySelector(".tab-caption")?.textContent?.trim(),
        ]),
      ),
    ).toEqual(tabs.map(([label, caption]) => [label, caption]))
    for (const i of [0, 1, 2, 3, 4, 0]) {
      await page.click(`.tabs button:nth-child(${i + 1})`)
      const shown = await visibleShots(page)
      expect(shown).toHaveLength(1)
      expect(shown[0]).toMatch(new RegExp(`^${tabs[i][2]}`))
      expect(
        await page.$$eval(".tabs button", (bs) =>
          bs.map((b) => b.getAttribute("aria-pressed")),
        ),
      ).toEqual(tabs.map((_, j) => String(j === i)))
    }
  } finally {
    await close()
  }
})

test("without JavaScript the hero shows the GraphQL screenshot", async () => {
  const { page, close } = await openSite({ javaScriptEnabled: false })
  try {
    const shown = await visibleShots(page)
    expect(shown).toHaveLength(1)
    expect(shown[0]).toMatch(/^SnapQL listing GraphQL/)
  } finally {
    await close()
  }
})

test("the hero trace lands on the SnapQL tab of the shot", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
  })
  try {
    const { traceBottom, endX, shots } = await page.$eval(".trace", (svg) => {
      const path = svg.querySelector("path") as SVGPathElement
      const end = path.getPointAtLength(path.getTotalLength())
      const ctm = path.getScreenCTM() as DOMMatrix
      const box = (
        document.querySelector(".shots") as HTMLElement
      ).getBoundingClientRect()
      return {
        traceBottom: svg.getBoundingClientRect().bottom,
        endX: end.x * ctm.a + ctm.e,
        shots: { top: box.top, left: box.left, width: box.width },
      }
    })
    expect(Math.abs(traceBottom - shots.top)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(endX - (shots.left + 0.68 * shots.width)),
    ).toBeLessThanOrEqual(2)
  } finally {
    await close()
  }
})

test("at phone width the hero drops the trace and fits the screen", async () => {
  const { page, close } = await openSite({
    viewport: { width: 390, height: 844 },
  })
  try {
    expect(await page.$eval(".trace", (e) => getComputedStyle(e).display)).toBe(
      "none",
    )
    expect(
      await page.$eval(
        ".tabs",
        (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
      ),
    ).toBe(2)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390)
  } finally {
    await close()
  }
})

test("workspaces says what they do and the nav reaches it", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
  })
  try {
    const text = (selector: string) => textOf(page, selector)
    expect(await text("#workspaces .label")).toBe("Workspaces")
    expect(await text("#workspaces h2")).toBe(
      "A saved view for every project you debug.",
    )
    expect(await text("#workspaces .intro")).toBe(
      "Pick the protocols and status codes you care about, hide the rest, and give it a name. Every change saves as you make it, and your workspaces are there each time you open DevTools.",
    )
    expect(
      await page.$$eval("#workspaces .rows li", (lis) =>
        lis.map((li) =>
          [".row-title", ".row-text"].map((s) =>
            li.querySelector(s)?.textContent?.replace(/\s+/g, " ").trim(),
          ),
        ),
      ),
    ).toEqual([
      [
        "Filter what matters",
        "Show only the protocols (graphql, grpc-web, websocket, llm…) and statuses (2xx, 4xx, failed) you're working on.",
      ],
      [
        "Hide the noise",
        "Preflights, cached responses, service worker copies and static assets stay out of the list, out of the box.",
      ],
      [
        "Switch in one click",
        "Jump between projects from the first button in the filter row. Nothing to save, nothing to set up again.",
      ],
    ])
    await page.click('nav a[href="#workspaces"]')
    await page.waitForFunction(() => window.scrollY > 0)
    const top = await page.$eval(
      "#workspaces",
      (e) => e.getBoundingClientRect().top,
    )
    expect(Math.abs(top)).toBeLessThanOrEqual(1)
  } finally {
    await close()
  }
})
