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
async function openSite(): Promise<{
  page: Page
  offsite: string[]
  close(): Promise<void>
}> {
  const browser = await chromium.launch()
  const page = await browser.newPage()
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

const links = (page: Page, selector: string) =>
  page.$$eval(`${selector} a`, (as) =>
    as.map((a) => [a.textContent?.trim(), a.getAttribute("href")]),
  )

test("nav and footer link where the design says, with no licence", async () => {
  const { version } = JSON.parse(
    await readFile(
      resolve(import.meta.dirname, "../../extension/package.json"),
      "utf8",
    ),
  )
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
