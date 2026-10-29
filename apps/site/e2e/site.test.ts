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
    reducedMotion?: "reduce" | "no-preference"
    path?: string
  } = {},
): Promise<{
  page: Page
  offsite: string[]
  close(): Promise<void>
}> {
  const browser = await chromium.launch()
  const { path: _, ...context } = options
  const page = await (await browser.newContext(context)).newPage()
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
  await page.goto(`${origin}${options.path ?? "/"}`)
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

// Wider than the viewport means the page scrolls sideways.
const scrollWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth)

// Clicks the nav link to a section; resolves to how far its top ends up from
// the top of the viewport.
const navLandsOn = async (page: Page, id: string) => {
  await page.click(`nav a[href="/#${id}"]`)
  await page.waitForFunction(() => window.scrollY > 0)
  return Math.abs(
    await page.$eval(`#${id}`, (e) => e.getBoundingClientRect().top),
  )
}

// Each match's children read in order, space-separated: flex items have no
// whitespace between them in textContent.
const partsOf = (page: Page, selector: string) =>
  page.$$eval(selector, (els) =>
    els.map((e) =>
      [...e.children]
        .map((c) => c.textContent?.replace(/\s+/g, " ").trim())
        .join(" "),
    ),
  )

// Content box of a container: its left edge and width inside the padding.
const contentBox = (page: Page, selector: string) =>
  page.$eval(selector, (e) => {
    const style = getComputedStyle(e)
    const left = Number.parseFloat(style.paddingLeft)
    return {
      left: e.getBoundingClientRect().left + left,
      width: e.clientWidth - left - Number.parseFloat(style.paddingRight),
    }
  })

// Every match spans the container's full content width.
const fillsContent = async (page: Page, items: string, container: string) => {
  const content = await contentBox(page, container)
  const boxes = await page.$$eval(items, (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return { left: r.left, width: r.width }
    }),
  )
  return (
    boxes.length > 0 &&
    boxes.every(
      (b) =>
        Math.abs(b.left - content.left) <= 1 &&
        Math.abs(b.width - content.width) <= 1,
    )
  )
}

const links = (page: Page, selector: string) =>
  page.$$eval(`${selector} a`, (as) =>
    as.map((a) => [a.textContent?.trim(), a.getAttribute("href")]),
  )

test("nav and footer link where the design says, with no licence", async () => {
  const version = await extensionVersion()
  const { page, close } = await openSite()
  try {
    expect(await links(page, "nav .nav-links")).toEqual([
      ["Workspaces", "/#workspaces"],
      ["Formats", "/#formats"],
      ["Quick start", "/#start"],
      ["Privacy", "/#privacy"],
      ["GitHub", "https://github.com/akshay-xp/snapql"],
    ])
    expect(await page.getAttribute("nav > a", "href")).toBe("/#top")
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

test("crawlers get robots.txt, a sitemap and one canonical URL", async () => {
  const site = "https://snapql.akxp.net/"
  expect(await readFile(join(dist, "robots.txt"), "utf8")).toContain(
    `Sitemap: ${site}sitemap.xml`,
  )
  expect(await readFile(join(dist, "sitemap.xml"), "utf8")).toContain(
    `<loc>${site}</loc>`,
  )
  const { page, close } = await openSite()
  try {
    expect(await page.getAttribute('link[rel="canonical"]', "href")).toBe(site)
  } finally {
    await close()
  }
})

test("link previews carry the title, description and post image", async () => {
  const site = "https://snapql.akxp.net/"
  const png = await readFile(join(dist, "og.png"))
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 1200])
  const { page, close } = await openSite()
  try {
    const meta = (key: string) =>
      page.$eval(`meta[property="${key}"], meta[name="${key}"]`, (m) =>
        m.getAttribute("content"),
      )
    const title = await page.title()
    const description = await meta("description")
    expect({
      "og:type": await meta("og:type"),
      "og:site_name": await meta("og:site_name"),
      "og:url": await meta("og:url"),
      "og:title": await meta("og:title"),
      "og:description": await meta("og:description"),
      "og:image": await meta("og:image"),
      "og:image:width": await meta("og:image:width"),
      "og:image:height": await meta("og:image:height"),
      "twitter:card": await meta("twitter:card"),
    }).toEqual({
      "og:type": "website",
      "og:site_name": "SnapQL",
      "og:url": site,
      "og:title": title,
      "og:description": description,
      "og:image": `${site}og.png`,
      "og:image:width": "1200",
      "og:image:height": "1200",
      "twitter:card": "summary_large_image",
    })
    expect(await meta("og:image:alt")).toBeTruthy()
  } finally {
    await close()
  }
})

test("unknown paths get a 404 page that leads home", async () => {
  const { page, close } = await openSite({
    path: "/404.html",
    viewport: { width: 1440, height: 900 },
  })
  try {
    expect(await page.title()).toContain("not found")
    expect(await page.getAttribute("main a", "href")).toBe("/")
    // A short page still keeps the footer at the bottom of the window.
    expect((await box(page, "footer")).bottom).toBe(900)
  } finally {
    await close()
  }
})

test("the page paints with no stylesheet request", async () => {
  const { page, close } = await openSite()
  try {
    expect(await page.$$('link[rel="stylesheet"]')).toHaveLength(0)
  } finally {
    await close()
  }
})

test("phones download smaller screenshots", async () => {
  const { page, close } = await openSite({
    viewport: { width: 390, height: 844 },
  })
  try {
    await scrollThrough(page)
    for (const selector of [".shots img:not([hidden])", "#workspaces img"]) {
      expect(
        await page.$eval(selector, (img: HTMLImageElement) => [
          img.currentSrc === new URL(img.src, location.href).href,
          img.naturalWidth < 1600,
        ]),
      ).toEqual([false, true])
    }
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
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390)
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
    expect(await navLandsOn(page, "workspaces")).toBeLessThanOrEqual(1)
  } finally {
    await close()
  }
})

const box = (page: Page, selector: string) =>
  page.$eval(selector, (e) => {
    const r = e.getBoundingClientRect()
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      width: r.width,
    }
  })

test("the workspace shot runs off the right edge on desktop", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
  })
  try {
    const img = "#workspaces img"
    expect(await page.$eval(img, (e) => e.getAttribute("alt"))).toMatch(
      /^The workspace menu open in SnapQL/,
    )
    await page.$eval(img, (e) => e.scrollIntoView())
    await page.waitForFunction(
      (s) => (document.querySelector(s) as HTMLImageElement).complete,
      img,
    )
    expect(
      await page.$eval(img, (e) => (e as HTMLImageElement).currentSrc),
    ).toContain("6-workspaces")
    const shot = await box(page, img)
    const rows = await box(page, "#workspaces .rows")
    expect(shot.width).toBe(1120)
    expect(shot.right).toBeGreaterThan(1440)
    expect(shot.left).toBeGreaterThan(rows.right)
    expect(await scrollWidth(page)).toBeLessThanOrEqual(1440)
  } finally {
    await close()
  }
})

test("at phone width the workspace shot stacks below the copy", async () => {
  const { page, close } = await openSite({
    viewport: { width: 390, height: 844 },
  })
  try {
    const shot = await box(page, "#workspaces img")
    const rows = await box(page, "#workspaces .rows")
    expect(shot.top).toBeGreaterThan(rows.bottom)
    expect(
      await fillsContent(page, "#workspaces img", "#workspaces .wrap"),
    ).toBe(true)
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390)
  } finally {
    await close()
  }
})

test("what it decodes shows seven cards in the design's grid", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
  })
  try {
    expect(await textOf(page, "#formats .label")).toBe("What it decodes")
    expect(await textOf(page, "#formats h2")).toBe(
      "From what's on the wire to what you meant.",
    )
    const cards = await page.$$eval("#formats .fmt", (els) =>
      els.map((e) => ({
        name: e.querySelector(".fmt-name")?.textContent?.trim(),
        wire: e.querySelector(".wire")?.textContent?.trim() ?? "",
        decoded: e.querySelector(".decoded")?.textContent?.trim() ?? "",
        width: e.getBoundingClientRect().width,
      })),
    )
    expect(cards.map((c) => c.name)).toEqual([
      "GraphQL",
      "gRPC-web",
      "WebSocket",
      "LLM streams",
      "JWTs",
      "MessagePack",
      "And the everyday ones",
    ])
    for (const card of cards.slice(0, 6)) {
      expect(card.wire).not.toBe("")
      expect(card.decoded).not.toBe("")
    }
    expect(cards[6].wire + cards[6].decoded).toBe("")
    const single = cards[1].width
    for (const i of [0, 3]) {
      expect(Math.abs(cards[i].width - (2 * single + 24))).toBeLessThanOrEqual(
        1,
      )
    }
    for (const i of [2, 4, 5, 6]) {
      expect(Math.abs(cards[i].width - single)).toBeLessThanOrEqual(1)
    }
    expect(
      await page.$$eval("#formats .more li", (lis) =>
        lis.map((li) => li.textContent?.trim()),
      ),
    ).toEqual([
      "REST and JSON",
      "Form data",
      "Multipart",
      "XML",
      "SOAP",
      "JSON-RPC",
      "tRPC",
      "CBOR",
      "Server-sent events",
      "NDJSON",
      "Images",
      "Fonts",
    ])
    expect(await navLandsOn(page, "formats")).toBeLessThanOrEqual(1)
  } finally {
    await close()
  }
})

// `key: value` lines of a decoded block; quoted strings and numbers parsed.
const decodedPairs = (decoded: string) =>
  Object.fromEntries(
    decoded
      .split("\n")
      .map((line) => line.match(/^(\w+): (.+)$/))
      .filter((m) => m !== null)
      .map(([, key, value]) => {
        try {
          return [key, JSON.parse(value)]
        } catch {
          return [key, value]
        }
      }),
  )

const varint = (bytes: Uint8Array, at: number): [number, number] => {
  let value = 0
  let shift = 0
  for (;;) {
    const byte = bytes[at++]
    value += (byte & 0x7f) * 2 ** shift
    if (byte < 0x80) return [value, at]
    shift += 7
  }
}

// Field number → string or varint; enough for the card's message.
const protobuf = (bytes: Uint8Array) => {
  const fields: Record<number, string | number> = {}
  let at = 0
  while (at < bytes.length) {
    const [tag, next] = varint(bytes, at)
    if ((tag & 7) === 2) {
      const [length, start] = varint(bytes, next)
      fields[tag >> 3] = new TextDecoder().decode(
        bytes.subarray(start, start + length),
      )
      at = start + length
    } else {
      ;[fields[tag >> 3], at] = varint(bytes, next)
    }
  }
  return fields
}

// fixmap of fixstr keys to fixstr or positive fixint values.
const msgpack = (bytes: Uint8Array) => {
  const map: Record<string, string | number> = {}
  let at = 1
  const read = () => {
    const byte = bytes[at++]
    if (byte < 0x80) return byte
    const text = new TextDecoder().decode(
      bytes.subarray(at, at + (byte & 0x1f)),
    )
    at += byte & 0x1f
    return text
  }
  for (let i = 0; i < (bytes[0] & 0x0f); i++) map[read()] = read()
  return map
}

test("the binary samples decode to what their cards show", async () => {
  const { page, close } = await openSite()
  try {
    const card = (name: string) =>
      page.$$eval(
        "#formats .fmt",
        (els, n) => {
          const el = els.find(
            (e) => e.querySelector(".fmt-name")?.textContent?.trim() === n,
          )
          return {
            wire: el?.querySelector(".wire")?.textContent ?? "",
            decoded: el?.querySelector(".decoded")?.textContent ?? "",
          }
        },
        name,
      )

    const grpc = await card("gRPC-web")
    const frame = Buffer.from(grpc.wire, "base64")
    expect(frame[0]).toBe(0)
    expect(frame.readUInt32BE(1)).toBe(frame.length - 5)
    const fields = protobuf(frame.subarray(5))
    const shown = decodedPairs(grpc.decoded)
    expect(fields[1]).toBe(shown.sku)
    expect(fields[2]).toBe(shown.name)
    expect(fields[3]).toBe(2)
    expect(shown.status).toBe("IN_STOCK")

    const jwt = await card("JWTs")
    const payload = jwt.wire.split(" ").at(-1)?.split(".")[1] ?? ""
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual(
      decodedPairs(jwt.decoded),
    )

    const mp = await card("MessagePack")
    const bytes = Uint8Array.from(
      mp.wire.split(" ").map((h) => Number.parseInt(h, 16)),
    )
    expect(msgpack(bytes)).toEqual(decodedPairs(mp.decoded))
  } finally {
    await close()
  }
})

test("at phone width the decode cards stack in one column", async () => {
  const { page, close } = await openSite({
    viewport: { width: 390, height: 844 },
  })
  try {
    expect(await fillsContent(page, "#formats .fmt", "#formats .wrap")).toBe(
      true,
    )
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390)
  } finally {
    await close()
  }
})

test("quick start walks through four steps with drawn tiles", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
  })
  try {
    expect(await textOf(page, "#start .label")).toBe("Quick start")
    expect(await textOf(page, "#start h2")).toBe("Running in under a minute.")
    expect(
      await page.$$eval("#start .steps li", (lis) =>
        lis.map((li) =>
          [".step-number", "h3", ".step-text"].map((s) =>
            li.querySelector(s)?.textContent?.replace(/\s+/g, " ").trim(),
          ),
        ),
      ),
    ).toEqual([
      [
        "1",
        "Install",
        "Add SnapQL from the Chrome Web Store. It asks for no permissions.",
      ],
      [
        "2",
        "Open DevTools",
        "On your app, right-click and choose Inspect, or press F12.",
      ],
      [
        "3",
        "Pick the SnapQL tab",
        "It sits beside Network. If it's hidden, find it under the » menu.",
      ],
      [
        "4",
        "Use your app",
        "Requests appear as they happen. Reload to catch the ones sent on load.",
      ],
    ])
    expect(
      await page.$$eval("#start .ill", (els) =>
        els.map((e) => e.getAttribute("aria-hidden")),
      ),
    ).toEqual(["true", "true", "true", "true"])
    expect(await partsOf(page, "#start .keyrow")).toEqual([
      "Mac ⌘ ⌥ I",
      "Windows F12",
    ])
    expect(await partsOf(page, "#start .dt-tabs")).toEqual([
      "Console Network SnapQL »",
    ])
    expect(await partsOf(page, "#start .rows > div:not(.keyrow)")).toEqual([
      "SearchFlights graphql",
      "GetProduct grpc-web",
      "/chat · 10 msgs websocket",
    ])
    const { endX, traceBottom, tab } = await page.$eval(
      "#start .dt-tabs .on",
      (on) => {
        const svg = on.querySelector("svg") as SVGSVGElement
        const path = svg.querySelector("path") as SVGPathElement
        const end = path.getPointAtLength(path.getTotalLength())
        const ctm = path.getScreenCTM() as DOMMatrix
        const r = on.getBoundingClientRect()
        return {
          endX: end.x * ctm.a + ctm.e,
          traceBottom: svg.getBoundingClientRect().bottom,
          tab: { top: r.top, centre: r.left + r.width / 2 },
        }
      },
    )
    expect(Math.abs(endX - tab.centre)).toBeLessThanOrEqual(2)
    expect(Math.abs(traceBottom - tab.top)).toBeLessThanOrEqual(1)
  } finally {
    await close()
  }
})

test("at phone width the quick start steps stack", async () => {
  const { page, close } = await openSite({
    viewport: { width: 390, height: 844 },
  })
  try {
    expect(await fillsContent(page, "#start .steps li", "#start .wrap")).toBe(
      true,
    )
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390)
  } finally {
    await close()
  }
})

test("quick start ends with three tips, stacked on phones", async () => {
  const tips = [
    "Search bodies. Turn on Include bodies to match text inside requests and responses, then step through the hits.",
    "Name gRPC fields. Add your .proto files under Schemas. They stay on your machine.",
    "Share a request. Copy it as cURL or fetch, or export a HAR with tokens, cookies and passwords redacted.",
  ]
  const desktop = await openSite({ viewport: { width: 1440, height: 900 } })
  try {
    expect(await textOf(desktop.page, "#start h3.tips-title")).toBe(
      "Good to know",
    )
    expect(
      await desktop.page.$$eval("#start .tip", (els) =>
        els.map((e) => e.textContent?.replace(/\s+/g, " ").trim()),
      ),
    ).toEqual(tips)
    expect(
      await desktop.page.$$eval("#start .tip svg", (els) =>
        els.map((e) => e.getAttribute("aria-hidden")),
      ),
    ).toEqual(["true", "true", "true"])
  } finally {
    await desktop.close()
  }
  const phone = await openSite({ viewport: { width: 390, height: 844 } })
  try {
    expect(await fillsContent(phone.page, "#start .tip", "#start .wrap")).toBe(
      true,
    )
  } finally {
    await phone.close()
  }
})

// A jump landed on the section: its top reached the viewport top, or the page
// is scrolled to the bottom (a short last section can't reach the top) with
// the whole section in view.
const landedOn = (page: Page, id: string) =>
  page.$eval(`#${id}`, (e) => {
    const r = e.getBoundingClientRect()
    const atBottom =
      Math.ceil(window.scrollY + window.innerHeight) >=
      document.documentElement.scrollHeight
    return (
      window.scrollY > 0 &&
      (Math.abs(r.top) <= 1 ||
        (atBottom && r.top >= 0 && r.bottom <= window.innerHeight + 1))
    )
  })

test("privacy says what SnapQL keeps, and links land on it", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
  })
  try {
    expect(await textOf(page, "#privacy .label")).toBe("Privacy")
    expect(await textOf(page, "#privacy h2")).toBe(
      "Your traffic never leaves your browser.",
    )
    expect(
      await page.$$eval("#privacy .copy p", (els) =>
        els.map((e) => e.textContent?.replace(/\s+/g, " ").trim()),
      ),
    ).toEqual([
      "SnapQL requests no permissions. It reads traffic through the DevTools APIs every extension has, and only while DevTools is open.",
      "It collects nothing and sends nothing anywhere. Captured requests are discarded when you close DevTools. The only things it keeps are your workspaces and any .proto files you add, in the extension's local storage on your device.",
      "The code is open source, so you can check all of this yourself.",
    ])
    await page.click('nav a[href="/#privacy"]')
    await page.waitForFunction(() => window.scrollY > 0)
    expect(await landedOn(page, "privacy")).toBe(true)
    expect(await navLandsOn(page, "start")).toBeLessThanOrEqual(1)
  } finally {
    await close()
  }
  const linked = await openSite({
    viewport: { width: 1440, height: 900 },
    path: "/#privacy",
  })
  try {
    await linked.page.waitForFunction(() => window.scrollY > 0)
    expect(await landedOn(linked.page, "privacy")).toBe(true)
  } finally {
    await linked.close()
  }
})

test("at phone width privacy stacks its copy below the heading", async () => {
  const { page, close } = await openSite({
    viewport: { width: 390, height: 844 },
  })
  try {
    const heading = await box(page, "#privacy h2")
    const copy = await box(page, "#privacy .copy")
    expect(copy.top).toBeGreaterThan(heading.bottom)
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390)
  } finally {
    await close()
  }
})

// Images a visitor can see have finished loading. Hidden hero shots are lazy
// and never load until their tab is shown.
const shownImagesLoaded = (page: Page) =>
  page.waitForFunction(() =>
    [...document.images]
      .filter((img) => img.offsetParent !== null)
      .every((img) => img.complete && img.naturalWidth > 0),
  )

// Scrolls a viewport at a time to the bottom, so lazy images load, then waits
// for the shown ones to finish.
const scrollThrough = async (page: Page) => {
  await page.evaluate(async () => {
    const atBottom = () =>
      Math.ceil(window.scrollY + window.innerHeight) >=
      document.documentElement.scrollHeight
    while (!atBottom()) {
      window.scrollBy(0, window.innerHeight)
      await new Promise((r) => setTimeout(r, 50))
    }
  })
  await shownImagesLoaded(page)
}

test("the whole page loads from its own origin and fits phones", async () => {
  const desktop = await openSite({ viewport: { width: 1440, height: 900 } })
  try {
    for (const tab of await desktop.page.$$(".tabs button")) {
      await tab.click()
      await shownImagesLoaded(desktop.page)
    }
    await scrollThrough(desktop.page)
    expect(desktop.offsite).toEqual([])
  } finally {
    await desktop.close()
  }
  const phone = await openSite({ viewport: { width: 390, height: 844 } })
  try {
    await scrollThrough(phone.page)
    expect(await scrollWidth(phone.page)).toBeLessThanOrEqual(390)
  } finally {
    await phone.close()
  }
})

test("every orange on the page is the one signal orange", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
  })
  try {
    // Any computed colour that reads as orange (strong red, mid green, little
    // blue) must be exactly --signal, #ff4419.
    const strays = await page.evaluate(() => {
      const orange = /^rgba?\((\d+), (\d+), (\d+)/
      const found = new Set<string>()
      for (const el of document.querySelectorAll("*")) {
        const style = getComputedStyle(el)
        for (const value of [
          style.color,
          style.backgroundColor,
          style.borderTopColor,
          style.stroke,
          style.fill,
          style.boxShadow,
        ]) {
          for (const part of value.match(/rgba?\([^)]*\)/g) ?? []) {
            const m = part.match(orange)
            if (!m) continue
            const [r, g, b] = m.slice(1).map(Number)
            const isOrange = r > 200 && g > 40 && g < 160 && b < 110
            if (isOrange && part !== "rgb(255, 68, 25)") found.add(part)
          }
        }
      }
      return [...found]
    })
    expect(strays).toEqual([])
  } finally {
    await close()
  }
})

// Index of the pressed hero tab.
const pressedTab = (page: Page) =>
  page.$$eval(".tabs button", (bs) =>
    bs.findIndex((b) => b.getAttribute("aria-pressed") === "true"),
  )

// Shortens the slide so autoplay can be watched in a test.
const setSlide = (page: Page, duration: string) =>
  page.$eval(
    ".showcase",
    (e, d) => (e as HTMLElement).style.setProperty("--slide", d),
    duration,
  )

test("the hero carousel moves on by itself and loops", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
  })
  try {
    await page.mouse.move(0, 0)
    await setSlide(page, "250ms")
    for (const next of [1, 2, 3, 4, 0]) {
      await page.waitForFunction(
        (i) =>
          document
            .querySelectorAll(".tabs button")
            [i]?.getAttribute("aria-pressed") === "true",
        next,
      )
      const shown = await visibleShots(page)
      expect(shown[0]).toMatch(new RegExp(`^${tabs[next][2]}`))
    }
  } finally {
    await close()
  }
})

test("the active tab's bar fills while its slide shows", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
  })
  try {
    await page.mouse.move(0, 0)
    await setSlide(page, "4s")
    expect(
      await page.$$eval(".tabs .tab-fill", (els) =>
        els.map((e) => getComputedStyle(e).animationName),
      ),
    ).toEqual(["tab-fill", "none", "none", "none", "none"])
    await page.waitForTimeout(1000)
    const scale = await page.$eval(
      '.tabs button[aria-pressed="true"] .tab-fill',
      (e) => new DOMMatrix(getComputedStyle(e).transform).a,
    )
    expect(scale).toBeGreaterThan(0.05)
    expect(scale).toBeLessThan(0.95)
  } finally {
    await close()
  }
})

test("hovering the carousel holds the current slide", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
  })
  try {
    // Shrinking --slide below the time already played ends the fill at once,
    // paused or not, so the slide stays longer than the setup takes.
    await setSlide(page, "1s")
    await page.hover(".shots")
    await page.waitForTimeout(1500)
    expect(await pressedTab(page)).toBe(0)
  } finally {
    await close()
  }
})

test("clicking a tab restarts the loop from there", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
  })
  try {
    await page.click(".tabs button:nth-child(4)")
    await page.mouse.move(0, 0)
    // Mouse focus doesn't pause; only keyboard focus does.
    await setSlide(page, "250ms")
    await page.waitForFunction(
      () =>
        document
          .querySelectorAll(".tabs button")[4]
          ?.getAttribute("aria-pressed") === "true",
    )
  } finally {
    await close()
  }
})

test("with reduced motion the carousel stays put, its bar full", async () => {
  const { page, close } = await openSite({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  })
  try {
    await page.mouse.move(0, 0)
    await setSlide(page, "250ms")
    await page.waitForTimeout(800)
    expect(await pressedTab(page)).toBe(0)
    expect(
      await page.$eval(
        '.tabs button[aria-pressed="true"] .tab-fill',
        (e) => new DOMMatrix(getComputedStyle(e).transform).a,
      ),
    ).toBe(1)
  } finally {
    await close()
  }
})
