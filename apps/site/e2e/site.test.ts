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
