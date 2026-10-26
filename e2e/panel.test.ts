import { expect, test } from "vitest"
import { requestBytes } from "../src/decoders/bytes"
import { defaultTheme } from "../src/panel/themes"
import { bodiesToggle, openPanel, PNG_BASE64 } from "./harness"

test("panel lists requests from the inspected page", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/one GET", "/api/two POST"]))
  } finally {
    await panel.close()
  }
})

test("clear empties the panel and later requests still appear", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/two POST"]))
    expect(await panel.text("header")).toBeNull()
    await panel.clear()
    await expect.poll(panel.rows).toEqual([])
    expect(await panel.text("footer [data-count]")).toBe("0 requests")
    const empty = [
      "Waiting for requests",
      "Reload the page to capture its traffic.",
    ]
    for (const line of empty) expect(await panel.text("main")).toContain(line)
    await panel.page.evaluate(() => fetch("/api/one"))
    await expect.poll(panel.rows).toEqual(["/api/one GET"])
    for (const line of empty)
      expect(await panel.text("main")).not.toContain(line)
    expect(await panel.text("footer [data-count]")).toBe("1 request")
  } finally {
    await panel.close()
  }
})

test("rows are newest first; the sort button flips the order", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const sequence = [
      "/api/one GET",
      "GetUser query graphql",
      "GetUser persisted graphql",
      "/api/two POST",
    ]
    await expect.poll(panel.rows).toEqual(expect.arrayContaining(sequence))
    const order = async () => {
      const rows = await panel.rows()
      return sequence.map((row) => rows.indexOf(row))
    }
    const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b)

    const newest = await order()
    expect(newest).toEqual(sorted(newest).reverse())
    expect(await panel.attr('button[aria-label="Newest first"]', "title")).toBe(
      "Newest first",
    )

    await panel.toggleSort()
    expect(await panel.attr('button[aria-label="Oldest first"]', "title")).toBe(
      "Oldest first",
    )
    const oldest = await order()
    expect(oldest).toEqual(sorted(oldest))

    await panel.press("End")
    expect(await panel.selectedRow()).toBe((await panel.rows()).at(-1))
  } finally {
    await panel.close()
  }
})

test("the search box filters rows and highlights matches", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/two POST"]))

    await panel.search("getuser")
    await expect
      .poll(panel.rows)
      .toEqual(["GetUser persisted graphql", "GetUser query graphql"])
    expect(await panel.text("footer [data-count]")).toMatch(/^2 of \d+$/)
    expect(await panel.text('[role="option"] mark')).toBe("GetUser")

    // Only what a row shows is searched: decoded rows don't show their method.
    await panel.search("POST")
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/two POST"]))
    expect(await panel.rows()).not.toContain("GetUser query graphql")
    expect(await panel.text('[role="option"] span:nth-child(2) mark')).toBe(
      "POST",
    )

    await panel.clearSearch()
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/one GET"]))
    expect(await panel.text("footer [data-count]")).toMatch(/^\d+ requests$/)

    await panel.search("zzz")
    await expect.poll(panel.rows).toEqual([])
    expect(await panel.text("main")).toContain('No requests match "zzz"')
    expect(await panel.text("main")).not.toContain("Waiting for requests")
    await panel.clickButton("Clear filter")
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/one GET"]))
  } finally {
    await panel.close()
  }
})

test("filtering out the selected request closes the pane", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const two = "/api/two POST"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([two]))
    await panel.select(two)
    expect(await panel.detail()).not.toBeNull()

    await panel.search("getuser")
    await expect.poll(panel.detail).toBeNull()
    expect(await panel.selectedRow()).toBeUndefined()

    await panel.clearSearch()
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([two]))
    expect(await panel.selectedRow()).toBeUndefined()
  } finally {
    await panel.close()
  }
})

test("decoded requests show their kind and summary", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    await expect
      .poll(panel.rows)
      .toEqual(
        expect.arrayContaining([
          "GetUser query graphql",
          "GetUser persisted graphql",
          "/api/one GET",
        ]),
      )
  } finally {
    await panel.close()
  }
})

test("requests made before the panel opened are backfilled", async () => {
  const panel = await openPanel({ visitFirst: true })
  try {
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/one GET", "/api/two POST"]))
  } finally {
    await panel.close()
  }
})

test("footer buttons are labeled and toggles fill when pressed", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/filters`)
    await expect.poll(async () => (await panel.rows()).length).toBe(5)
    const button = (label: string) => `footer button[aria-label="${label}"]`
    expect(await panel.text(button("Clear"))).toBe("Clear")
    expect(await panel.text(button("Newest first"))).toBe("Newest")
    expect(await panel.text(button("Reload and capture"))).toBe("Reload")
    for (const [label, caption] of [
      ["Preserve log", "Preserve"],
      ["Schemas", "Schemas"],
      ["Export HAR", "Export"],
    ]) {
      expect(await panel.text(button(label))).toBe(caption)
      const off = await panel.style(button(label), "background-color")
      await panel.click(button(label))
      expect(await panel.style(button(label), "background-color")).not.toBe(off)
      await panel.click(button(label))
    }
  } finally {
    await panel.close()
  }
})

test("navigating clears old rows unless Preserve log is on", async () => {
  const panel = await openPanel()
  try {
    const two = "/api/two POST"
    const three = "/api/three GET"
    const visit = async (path: string, row: string) => {
      await panel.page.goto(panel.origin + path)
      await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))
    }

    await visit("/", two)
    await visit("/other", three)
    expect(await panel.rows()).not.toContain(two)

    const pressed = () =>
      panel.attr('button[aria-label="Preserve log"]', "aria-pressed")
    expect(await pressed()).toBe("false")
    await panel.togglePreserveLog()
    expect(await pressed()).toBe("true")
    await visit("/", two)
    await visit("/other", three)
    expect(await panel.rows()).toContain(two)
  } finally {
    await panel.close()
  }
})

for (const kind of ["light", "dark"] as const) {
  test(`panel follows the ${kind} DevTools theme`, async () => {
    const panel = await openPanel({ devtoolsTheme: kind })
    try {
      expect(await panel.devtoolsTheme()).toBe(kind)
      await expect.poll(panel.themeKind).toBe(kind)
      // Native scrollbars and form controls follow it.
      expect(await panel.style("html", "color-scheme")).toBe(kind)
      expect(await panel.cssVar("--theme-bg")).toBe(
        defaultTheme(kind).colors.bg,
      )
    } finally {
      await panel.close()
    }
  })
}

test("the active tab is underlined in the accent color", async () => {
  const panel = await openPanel({ devtoolsTheme: "dark" })
  try {
    await panel.page.goto(panel.origin)
    const row = "GetUser query graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))
    await panel.select(row)
    expect(
      await panel.style(
        '[role="tab"][aria-selected="true"]',
        "border-bottom-color",
      ),
    ).toBe("rgb(124, 172, 248)")
  } finally {
    await panel.close()
  }
})

test("rows select from the keyboard or by click", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const two = "/api/two POST"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([two]))
    const [first] = await panel.rows()

    await panel.press("ArrowDown")
    expect(await panel.selectedRow()).toBe(first)

    await panel.select(two)
    expect(await panel.selectedRow()).toBe(two)
  } finally {
    await panel.close()
  }
})

test("selecting opens the detail pane; Esc and Clear close it", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/two POST"]))

    await panel.press("ArrowDown")
    expect(await panel.activeTab()).toBe("Summary")
    expect(await panel.detail()).not.toBeNull()

    await panel.press("Escape")
    expect(await panel.detail()).toBeNull()

    await panel.press("ArrowDown")
    await panel.clear()
    await expect.poll(panel.detail).toBeNull()
  } finally {
    await panel.close()
  }
})

test("Summary shows the request and its decoded data", async () => {
  const panel = await openPanel({ devtoolsTheme: "dark" })
  try {
    await panel.page.goto(panel.origin)
    const row = "GetUser query graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))

    await panel.select(row)

    const detail = await panel.detail()
    expect(detail).toContain("query GetUser { user { id } }")
    expect(await panel.text('[role="tabpanel"] header')).toMatch(
      /^GetUser graphql query Copy as POST \/graphql · 200 OK · \d+ ms · \d\d:\d\d:\d\d$/,
    )
    expect(
      await panel.attr('[role="tabpanel"] header [data-path]', "title"),
    ).toBe(`${panel.origin}/graphql`)
    expect(
      await panel.style('[role="tabpanel"] header [data-status]', "color"),
    ).toBe("rgb(129, 201, 149)")
    expect(
      await panel.style(
        '[role="tabpanel"] section > [data-block]',
        "background-color",
      ),
    ).toBe("rgb(31, 31, 31)")
    expect(await panel.style('[role="tabpanel"] section h2', "color")).toBe(
      "rgb(143, 143, 143)",
    )
    expect(detail).toContain('id: "1"')

    await panel.stubClipboard()
    await panel.click('button[aria-label="Copy variables"]')
    expect(await panel.copied()).toBe('{\n  "id": "1"\n}')
    expect(
      await panel.attr(
        '[role="tabpanel"] button[aria-label="Copied"]',
        "title",
      ),
    ).toBe("Copied")
    await expect
      .poll(() => panel.attr('button[aria-label="Copy variables"]', "title"), {
        timeout: 3000,
      })
      .toBe("Copy variables")
    await panel.click('button[aria-label="Copy query"]')
    expect(await panel.copied()).toBe("query GetUser { user { id } }")

    const caret = '[role="tabpanel"] button[aria-expanded]:not([aria-haspopup])'
    expect(await panel.attr(caret, "aria-expanded")).toBe("true")
    expect(
      await panel.style('[role="tabpanel"] [data-json="string"]', "color"),
    ).toBe("rgb(242, 162, 117)")
    expect(
      await panel.style('[role="tabpanel"] [data-json="key"]', "color"),
    ).toBe("rgb(124, 172, 248)")
    await panel.click(caret)
    expect(await panel.detail()).toContain("{…} 1 key")
    expect(await panel.detail()).not.toContain('id: "1"')
  } finally {
    await panel.close()
  }
})

test("selected rows keep full-contrast text and tags align", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const row = "GetUser query graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))
    await panel.select(row)

    const part = (n: string) =>
      panel.style(`[aria-selected="true"] > span:${n}`, "color")
    expect(await part("nth-child(2)")).toBe(await part("nth-child(1)"))
    const tag = () =>
      panel.style('[aria-selected="true"] > span:last-child', "width")
    const graphqlTag = await tag()
    await panel.select("/api/one GET")
    expect(await tag()).toBe(graphqlTag)
  } finally {
    await panel.close()
  }
})

test("labels are sans and request data is monospace", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const row = "GetUser query graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))
    await panel.select(row)

    const mono = async (selector: string) =>
      (await panel.style(selector, "font-family")).includes("monospace")
    expect(await panel.style("main", "font-size")).toBe("12px")
    for (const label of [
      "main",
      '[role="tab"]',
      '[role="tabpanel"] section h2',
      "footer span",
      'input[aria-label="Filter requests"]',
    ])
      expect(await mono(label), label).toBe(false)
    for (const data of [
      '[role="option"]',
      '[role="tabpanel"] header',
      '[role="tabpanel"] pre',
    ])
      expect(await mono(data), data).toBe(true)

    await panel.openTab("Headers")
    expect(await mono('[role="tabpanel"] dd')).toBe(true)
    await panel.openTab("Timing")
    expect(await mono('[role="tabpanel"] [data-ms]')).toBe(true)
    expect(await mono('[role="tabpanel"] [data-phase]')).toBe(false)
  } finally {
    await panel.close()
  }
})

test("JSON bodies render as a tree with Expand all", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/decoders`)
    const row = "/api/users/1 GET json"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))
    await panel.select(row)
    await panel.openTab("Body")

    await expect.poll(panel.detail).toContain("geo: {…} 1 key")
    const body = (await panel.detail()) ?? ""
    expect(body).not.toContain("lat: 1")
    expect(body).toContain(`"${"b".repeat(200)}"…show more`)
    expect(body).not.toContain("b".repeat(201))

    await panel.clickButton("show more")
    expect(await panel.detail()).toContain("b".repeat(250))
    await panel.clickButton("Expand all")
    expect(await panel.detail()).toContain("lat: 1")

    await panel.stubClipboard()
    await panel.clickButton("Copy")
    expect(await panel.copied()).toBe(
      JSON.stringify(
        {
          id: 1,
          bio: "b".repeat(250),
          profile: { address: { geo: { lat: 1 } } },
        },
        null,
        2,
      ),
    )
    expect(await panel.detail()).toContain("Copied")
  } finally {
    await panel.close()
  }
})

test("Body tab loads and pretty-prints the response", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const row = "GetUser query graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))

    await panel.select(row)
    await panel.openTab("Body")

    expect(await panel.activeTab()).toBe("Body")
    await expect.poll(panel.detail).toContain("data: {}")
  } finally {
    await panel.close()
  }
})

test("Headers and Params/Cookies tabs list name/value pairs", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const post = "GetUser query graphql"
    const apq = "GetUser persisted graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([post, apq]))

    await panel.select(post)
    await panel.openTab("Headers")
    expect(await panel.pairs()).toMatch(/content-type = application\/json/i)

    await panel.select(apq)
    await panel.openTab("Params/Cookies")
    expect(await panel.pairs()).toContain("operationName = GetUser")
  } finally {
    await panel.close()
  }
})

test("Timing tab shows stage tiles over a labelled waterfall", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const post = "GetUser query graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([post]))

    await panel.select(post)
    await panel.openTab("Timing")

    const detail = await panel.detail()
    expect(await panel.text("[data-total]")).toMatch(/^[\d.]+ ms$/)
    expect(await panel.text("[data-stages]")).toMatch(
      /Server [\d.]+ ms \d+% .*Download [\d.]+ ms \d+%/,
    )
    expect(await panel.count("[data-stage][data-top]")).toBe(1)
    expect(await panel.text("section h2")).toBe("Phases")
    expect(detail).toMatch(/Waiting \(TTFB\)\s+[\d.]+ ms/)
    expect(detail).not.toMatch(/\b(wait|ssl)\b/)
    const lefts = await panel.lefts("[data-bar]")
    expect(lefts.length).toBeGreaterThan(1)
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b))
  } finally {
    await panel.close()
  }
})

test("Timing stages follow the selected request", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const rows = ["GetUser query graphql", "/api/one GET", "/ GET"]
    await expect.poll(panel.rows).toEqual(expect.arrayContaining(rows))

    await panel.select(rows[0])
    await panel.openTab("Timing")
    for (const row of rows.slice(1)) {
      await panel.select(row)
      const kept = await panel.text("[data-stages]")
      await panel.openTab("Summary")
      await panel.openTab("Timing")
      expect(kept).toBe(await panel.text("[data-stages]"))
    }
  } finally {
    await panel.close()
  }
})

test("a response without a body opens cleanly in Body and Raw", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/empty`)
    await expect.poll(panel.rows).toContain("/empty GET")
    await panel.unhide("preflights")
    const row = "/api/empty OPTIONS"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))

    await panel.select(row)
    for (const tab of ["Body", "Raw"]) {
      await panel.openTab(tab)
      await expect
        .poll(panel.detail)
        .toMatch(tab === "Raw" ? /Response/ : /^No response body$/)
      expect(await panel.detail(), tab).not.toContain("unavailable")
    }
  } finally {
    await panel.close()
  }
})

test("Raw tab shows the request and response as sent", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const post = "GetUser query graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([post]))

    await panel.select(post)
    await panel.openTab("Raw")

    await expect.poll(panel.detail).toContain('{"data":{}}')
    const raw = await panel.detail()
    expect(raw).toContain("POST /graphql HTTP/1.1")
    expect(raw).toContain("HTTP/1.1 200")

    await panel.stubClipboard()
    await panel.clickButton("Copy")
    const copied = (await panel.copied()) ?? ""
    const order = ["POST /graphql HTTP/1.1", "HTTP/1.1 200", '{"data":{}}'].map(
      (text) => copied.indexOf(text),
    )
    expect(order.every((at) => at >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  } finally {
    await panel.close()
  }
})

test("arrow keys move between detail tabs and wrap", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/two POST"]))
    await panel.press("ArrowDown")

    await panel.pressTab("ArrowRight")
    expect(await panel.activeTab()).toBe("Body")

    await panel.pressTab("ArrowLeft")
    await panel.pressTab("ArrowLeft")
    expect(await panel.activeTab()).toBe("Raw")
    await panel.pressTab("ArrowLeft")
    expect(await panel.activeTab()).toBe("Timing")
  } finally {
    await panel.close()
  }
})

test("a large session renders only the visible rows", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/bulk`)
    await expect
      .poll(() => panel.page.title(), { timeout: 30_000 })
      .toBe("done")

    await expect.poll(panel.optionCount).toBeGreaterThan(0)
    expect(await panel.optionCount()).toBeLessThan(100)
    expect(await panel.style('[role="option"]', "height")).toBe("28px")

    // Capture can trail the page, so retry End until the last item is in.
    await expect
      .poll(async () => {
        await panel.press("Home")
        return panel.selectedRow()
      })
      .toMatch(/\/api\/item\?i=999 GET$/)
    expect(await panel.selectedVisible()).toBe(true)
  } finally {
    await panel.close()
  }
}, 60_000)

test("a tall panel stacks the list over the detail pane", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/two POST"]))
    await panel.press("ArrowDown")

    const { list, detail } = await panel.paneBoxes()
    expect(detail.top).toBeGreaterThan(list.bottom)
    expect(detail.left).toBe(list.left)
    expect(await panel.attr("hr[aria-orientation]", "aria-orientation")).toBe(
      "horizontal",
    )

    const height = (b: { top: number; bottom: number }) => b.bottom - b.top
    const before = height(detail)
    await panel.dragDivider(0, -50)
    const grown = height((await panel.paneBoxes()).detail) - before
    expect(Math.abs(grown - 50)).toBeLessThanOrEqual(1)
    await panel.dragDivider(0, 10_000)
    expect(height((await panel.paneBoxes()).detail)).toBe(200)

    await panel.dock("bottom")
    await expect
      .poll(async () => {
        const boxes = await panel.paneBoxes()
        return boxes.detail.left >= boxes.list.right
      })
      .toBe(true)
  } finally {
    await panel.close()
  }
})

test("the detail pane keeps one spacing rhythm", async () => {
  const panel = await openPanel()
  try {
    await panel.dock("bottom")
    await panel.page.goto(`${panel.origin}/decoders`)
    const row = "/api/me GET json"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))
    await panel.select(row)

    // The tab bar lines up with the search bar beside it.
    expect(await panel.style('[role="tablist"]', "height")).toBe("40px")
    expect(await panel.style("search", "height")).toBe("40px")
    await panel.openTab("Headers")
    expect(await panel.style('[role="tabpanel"]', "padding-top")).toBe("12px")
    expect(await panel.style('[role="tabpanel"]', "row-gap")).toBe("16px")
    expect(await panel.style('[role="tabpanel"] section', "margin-top")).toBe(
      "0px",
    )
    expect(await panel.style('[role="tabpanel"] dd', "overflow-wrap")).toBe(
      "anywhere",
    )
    await panel.openTab("Raw")
    await expect.poll(panel.detail).toContain("HTTP/1.1 200")
    expect(
      await panel.style('[role="tabpanel"] [data-block] pre', "overflow-wrap"),
    ).toBe("anywhere")
  } finally {
    await panel.close()
  }
})

test("dragging the divider resizes the detail pane", async () => {
  const panel = await openPanel()
  try {
    await panel.dock("bottom")
    await panel.page.goto(panel.origin)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/two POST"]))
    await panel.press("ArrowDown")
    const { detail } = await panel.paneWidths()

    await panel.dragDivider(-50)

    // The initial 50% width can be fractional; allow 1px of rounding.
    const grown = (await panel.paneWidths()).detail - detail
    expect(Math.abs(grown - 50)).toBeLessThanOrEqual(1)

    const clear = 'footer button[aria-label="Clear"]'
    await panel.dragDivider(10_000)
    expect((await panel.paneWidths()).detail).toBe(200)
    expect(await panel.text(clear)).toBe("Clear")
    await panel.dragDivider(-10_000)
    expect((await panel.paneWidths()).list).toBe(200)
    // Too narrow for captions: icons and tooltips only, nothing cut off.
    expect(await panel.text(clear)).toBe("")
    expect(await panel.overflowing("footer")).toEqual([])
    expect(await panel.errors()).toEqual([])
  } finally {
    await panel.close()
  }
})

test("M3 decoders summarize their requests", async () => {
  const panel = await openPanel({ devtoolsTheme: "light" })
  try {
    await panel.page.goto(`${panel.origin}/decoders`)
    await expect
      .poll(panel.rows)
      .toEqual(
        expect.arrayContaining([
          "/api/users/1 GET json",
          "/api/form 2 fields form",
          "/api/upload 1 field, 1 file multipart",
          "GetPrice soap",
          "sum jsonrpc",
          "user.byId, post.list 2 procedures trpc",
          "A, B 2 ops graphql",
          "Upload mutation graphql",
          "Broken query graphql",
          "Deferred query graphql",
          "/api/me GET json",
          "/api/missing GET 404",
        ]),
      )

    // Kind tags fit their text, including the longest kind, "multipart".
    expect(
      await panel.overflowing('[role="option"] > span:last-child'),
    ).toEqual([])

    await panel.select("/api/missing GET 404")
    expect(await panel.text('[role="tabpanel"] header')).toContain(
      "404 Not Found",
    )
    expect(
      await panel.style('[role="tabpanel"] header [data-status]', "color"),
    ).toBe("rgb(179, 38, 30)")

    await panel.select("/api/form 2 fields form")
    const form = await panel.pairs()
    expect(form).toContain("a = 1")
    expect(form).toContain("b = x y")
    await panel.stubClipboard()
    await panel.click('button[aria-label="Copy fields"]')
    expect(await panel.copied()).toBe("a = 1\nb = x y")

    await panel.select("/api/upload 1 field, 1 file multipart")
    const upload = await panel.pairs()
    expect(upload).toContain("a = 1")
    expect(upload).toContain("f = f.txt (text/plain, ")

    await panel.select("A, B 2 ops graphql")
    expect(await panel.pairs()).toContain("query A = query A { a }")

    await panel.select("Upload mutation graphql")
    expect(await panel.pairs()).toContain("0 = a.txt (text/plain, ")

    await panel.select("Broken query graphql")
    for (const text of ["Response", "2 errors"])
      await expect.poll(panel.detail).toContain(text)
    for (const pair of ["user.posts.0 = boom", "(root) = bad"])
      await expect.poll(panel.pairs).toContain(pair)
    expect(
      await panel.style('[data-section="errors"] [data-value]', "color"),
    ).toBe("rgb(179, 38, 30)")

    await panel.select("Deferred query graphql")
    for (const text of ["no errors", 'id: "1"', 'name: "Ada"', "parts"])
      await expect.poll(panel.detail).toContain(text)

    await panel.select("/api/me GET json")
    const me = await panel.detail()
    for (const text of [
      "Tokens",
      "Authorization header · unverified",
      "expires 2033-05-18T03:33:20.000Z",
      'sub: "42"',
      'alg: "HS256"',
    ])
      expect(me).toContain(text)
    await panel.click('button[aria-label="Copy Tokens"]')
    expect(await panel.copied()).toContain('"sub": "42"')
    expect(await panel.copied()).toContain('"alg": "HS256"')
    await panel.openTab("Params/Cookies")
    expect(await panel.pairs()).toContain("greeting = hello%20world")
    expect(await panel.detail()).toContain("\nhello world")
    await panel.openTab("Summary")

    await panel.select("user.byId, post.list 2 procedures trpc")
    const batch = await panel.pairs()
    expect(batch).toContain('user.byId = {"id":1}')
    expect(batch).toContain("post.list = {}")

    await panel.select("GetPrice soap")
    expect(await panel.detail()).toContain("<m:Item>Apples</m:Item>")
    await panel.openTab("Body")
    await expect.poll(panel.detail).toContain("\n  <soap:Body>")
  } finally {
    await panel.close()
  }
})

test("streamed responses list their messages", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/streams`)
    await expect
      .poll(panel.rows)
      .toEqual(
        expect.arrayContaining(["/api/sse GET sse", "/api/ndjson GET ndjson"]),
      )

    await panel.select("/api/sse GET sse")
    await panel.openTab("Body")
    await expect.poll(panel.detail).toContain("event: ping")
    await panel.openTab("Messages")
    await expect
      .poll(panel.messages)
      .toEqual(['{"n":1} 7 B', 'ping {"n":2} 7 B', "line one line two 17 B"])

    await panel.select("/api/ndjson GET ndjson")
    await expect.poll(panel.messages).toHaveLength(3)

    await panel.page.goto(`${panel.origin}/decoders`)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["Deferred query graphql"]))
    await panel.select("Deferred query graphql")
    await panel.openTab("Messages")
    await expect.poll(panel.messages).toHaveLength(2)
    expect((await panel.messages()).join(" ")).not.toMatch(/\+\d/)
  } finally {
    await panel.close()
  }
})

test("selecting a stream message shows it with a copy button", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/streams`)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/sse GET sse"]))
    await panel.select("/api/sse GET sse")
    await panel.openTab("Messages")
    await expect.poll(panel.messages).toHaveLength(3)
    await panel.stubClipboard()

    await panel.click("#message-0")
    expect(await panel.attr("#message-0", "aria-selected")).toBe("true")
    expect(await panel.text('[role="tabpanel"] section h2')).toBe("Message 1")
    expect(await panel.text('[role="tabpanel"] [data-json="key"]')).toContain(
      "n",
    )
    expect(await panel.text('[role="tabpanel"] [data-json="number"]')).toBe("1")
    await panel.click('button[aria-label="Copy Message 1"]')
    await expect.poll(panel.copied).toBe('{"n":1}')

    await panel.click("#message-2")
    expect(await panel.text('[role="tabpanel"] section pre')).toBe(
      "line one line two",
    )
    await panel.click('button[aria-label="Copy Message 3"]')
    await expect.poll(panel.copied).toBe("line one\nline two")

    await panel.press("ArrowUp", "Messages")
    expect(await panel.attr("#message-1", "aria-selected")).toBe("true")
    expect(await panel.text('[role="tabpanel"] section h2')).toBe("Message 2")
  } finally {
    await panel.close()
  }
})

test("LLM streams show the reassembled reply in Summary", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/streams`)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["gpt-test stream llm"]))
    await panel.select("gpt-test stream llm")
    await panel.stubClipboard()

    await expect.poll(panel.detail).toContain("Response · tool_calls")
    const detail = await panel.detail()
    expect(detail).toContain("reply")
    expect(detail).toContain("Hello")
    expect(detail).toContain("tool get_weather")
    expect(detail).toContain("city")
    await panel.click('button[aria-label="Copy reply"]')
    await expect.poll(panel.copied).toBe("Hello")

    await panel.openTab("Messages")
    await expect.poll(panel.messages).toHaveLength(7)
    expect((await panel.messages()).at(-1)).toBe("[DONE] 6 B")
  } finally {
    await panel.close()
  }
})

test("streams are captured live and merge when they finish", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/live`)
    await expect.poll(panel.probed).toBe(true)
    const liveRow = (prefix: string) => async () =>
      (await panel.rows()).filter((r) => r.startsWith(`${prefix} `))

    await panel.page.click("#es")
    await expect
      .poll(liveRow("/api/live"))
      .toEqual([
        expect.stringMatching(/^\/api\/live GET live [1-9] msgs? sse$/),
      ])
    await panel.selectStarting("/api/live ")
    await panel.openTab("Messages")
    await expect
      .poll(async () => (await panel.messages())[0] ?? "")
      .toMatch(/^\+0\.000s \{"n":1\}/)
    await expect
      .poll(liveRow("/api/live"), { timeout: 5000 })
      .toEqual([expect.stringMatching(/^\/api\/live GET (\S+ )?11 msgs sse$/)])

    await panel.page.click("#fetch")
    await expect
      .poll(liveRow("/api/live-fetch"))
      .toEqual([expect.stringMatching(/ live \d+ msgs? sse$/)])
    await panel.selectStarting("/api/live-fetch ")
    await panel.openTab("Body")
    await expect.poll(panel.detail).toContain('data: {"n":1}')
    await expect
      .poll(liveRow("/api/live-fetch"), { timeout: 6000 })
      .toEqual([
        expect.stringMatching(/^\/api\/live-fetch GET (\S+ )?21 msgs sse$/),
      ])
  } finally {
    await panel.close()
  }
})

test("Messages follows new messages only from the bottom", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/live`)
    await expect.poll(panel.probed).toBe(true)
    await panel.page.evaluate(() => {
      const es = new EventSource("/api/live?n=80&ms=40")
      es.addEventListener("done", () => es.close())
    })
    const count = async () => {
      const row = (await panel.rows()).find((r) => r.startsWith("/api/live "))
      return Number(row?.match(/(\d+) msgs?/)?.[1] ?? 0)
    }
    await expect.poll(count, { timeout: 5000 }).toBeGreaterThan(0)
    await panel.selectStarting("/api/live ")
    await panel.openTab("Messages")

    await expect.poll(count, { timeout: 5000 }).toBeGreaterThan(30)
    await panel.scrollList("Messages", "bottom")
    const seen = await count()
    await expect.poll(count, { timeout: 5000 }).toBeGreaterThan(seen + 10)
    expect((await panel.scrollState("Messages")).gap).toBeLessThanOrEqual(28)

    await panel.scrollList("Messages", "top")
    const later = await count()
    await expect.poll(count, { timeout: 5000 }).toBeGreaterThan(later + 5)
    expect((await panel.scrollState("Messages")).top).toBe(0)
  } finally {
    await panel.close()
  }
})

test("Reload and capture catches streams opened while loading", async () => {
  const panel = await openPanel()
  try {
    expect(await panel.text("main")).toContain("Reload and capture")

    await panel.page.goto(`${panel.origin}/early`)
    await expect.poll(panel.probed).toBe(true)
    const early = async () =>
      (await panel.rows()).filter((r) => r.startsWith("/api/live "))
    await new Promise((r) => setTimeout(r, 800))
    expect(await early()).toEqual([])

    await panel.click('button[aria-label="Reload and capture"]')
    await expect
      .poll(early, { timeout: 5000 })
      .toEqual([expect.stringMatching(/ live \d+ msgs? sse$/)])
  } finally {
    await panel.close()
  }
})

test("WebSockets show their frames live and close into one row", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/socket`)
    await expect.poll(panel.probed).toBe(true)
    const sockets = async () =>
      (await panel.rows()).filter((r) => r.startsWith("/sock "))

    await panel.page.click("#open")
    await expect.poll(sockets).toEqual(["/sock chat live 4 msgs websocket"])
    await panel.selectStarting("/sock ")
    expect(await panel.text('[role="tablist"]')).toBe(
      "Summary Messages Headers",
    )
    await panel.openTab("Messages")
    await expect
      .poll(panel.messages)
      .toEqual([
        expect.stringMatching(/^\+\d+\.\d{3}s ↑ hi 2 B$/),
        expect.stringMatching(/^\+\d+\.\d{3}s ↑ binary 4 B 4 B$/),
        expect.stringMatching(/^\+\d+\.\d{3}s ↓ hi 2 B$/),
        expect.stringMatching(/^\+\d+\.\d{3}s ↓ binary 4 B 4 B$/),
      ])

    await panel.page.click("#close")
    await expect
      .poll(sockets, { timeout: 5000 })
      .toEqual(["/sock chat closed 1000 4 msgs websocket"])
    await panel.openTab("Summary")
    const summary = await panel.detail()
    expect(summary).toContain("closed 1000")
    expect(summary).toContain("frames sent")
    expect(summary).toContain("bye")
    await panel.openTab("Headers")
    await expect.poll(panel.detail, { timeout: 5000 }).toContain("Upgrade")
    expect(await sockets()).toHaveLength(1)
  } finally {
    await panel.close()
  }
})

test("Socket.IO and graphql-ws frames are titled by their protocol", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/socket`)
    await expect.poll(panel.probed).toBe(true)
    // Direction and title only: offsets and sizes vary.
    const titles = async () =>
      (await panel.messages()).map((r) =>
        r.replace(/^\+\S+ /, "").replace(/ \S+ k?B$/, ""),
      )

    await panel.page.click("#sio")
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/socket.io/ live 6 msgs socketio"]))
    await panel.selectStarting("/socket.io/ ")
    await panel.openTab("Messages")
    await expect
      .poll(titles)
      .toEqual([
        "↑ connect",
        "↑ chat",
        "↑ ping",
        "↓ connect",
        "↓ chat",
        "↓ ping",
      ])
    await panel.click("#message-1")
    expect(
      await panel.text('[role="tabpanel"] section [data-json="key"]'),
    ).toBe("args")

    await panel.page.click("#gql")
    await expect
      .poll(panel.rows)
      .toEqual(
        expect.arrayContaining([
          "/graphql-ws graphql-transport-ws live 6 msgs graphql-ws",
        ]),
      )
    await panel.selectStarting("/graphql-ws ")
    await expect
      .poll(titles)
      .toEqual([
        "↑ connection_init",
        "↑ OnMsg subscribe",
        "↑ OnMsg next",
        "↓ connection_init",
        "↓ OnMsg subscribe",
        "↓ OnMsg next",
      ])
  } finally {
    await panel.close()
  }
})

// Pins Chrome's HAR text for binary request bodies: valid UTF-8 is decoded,
// anything else maps each byte to one code unit (Latin-1), so no byte is lost.
test("binary request bodies reach the HAR as UTF-8 or Latin-1 text", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/binary`)
    await expect
      .poll(panel.rows)
      .toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^\/api\/binary /),
          expect.stringMatching(/^\/api\/binary-utf8 /),
        ]),
      )
    const codes = async (url: string) =>
      [...((await panel.postData(url)) ?? "")].map((c) => c.charCodeAt(0))
    expect(await codes("/api/binary")).toEqual([0, 0xff, 0x80, 1, 0xc3, 0xa9])
    expect(await codes("/api/binary-utf8")).toEqual([0xe9, 1])
    const candidates = async (url: string) =>
      requestBytes((await panel.postData(url)) ?? "").map((b) => [...b])
    expect(await candidates("/api/binary")).toContainEqual([
      0, 0xff, 0x80, 1, 0xc3, 0xa9,
    ])
    expect(await candidates("/api/binary-utf8")).toContainEqual([
      0xc3, 0xa9, 0x01,
    ])
  } finally {
    await panel.close()
  }
})

test("protobuf requests and responses show their messages", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/protobuf`)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/proto POST protobuf"]))
    await panel.select("/api/proto POST protobuf")
    await expect.poll(panel.detail).toContain("Response · 7 bytes")
    const detail = await panel.detail()
    for (const text of ["message", '"hi"', "150", '"abc"'])
      expect(detail).toContain(text)
  } finally {
    await panel.close()
  }
})

test("gRPC-web calls show method, messages and status", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/grpc`)
    const unary = "GetUser example.UserService grpc-web"
    const stream = "ListUsers example.UserService grpc-web"
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining([unary, stream]))

    await panel.select(unary)
    await expect.poll(panel.detail).toContain("Response · OK")
    const detail = await panel.detail()
    for (const text of ['"hi"', "150", '"abc"']) expect(detail).toContain(text)

    await panel.select(stream)
    await expect.poll(panel.detail).toContain("Response · NOT_FOUND")
    const streamed = await panel.detail()
    for (const text of ["message 1", "message 2", "NOT_FOUND: gone"])
      expect(streamed).toContain(text)
  } finally {
    await panel.close()
  }
})

test("msgpack and CBOR exchanges show their values", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/packed`)
    const msgpack = "/api/msgpack POST msgpack"
    const cbor = "/api/cbor POST cbor"
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining([msgpack, cbor]))

    await panel.select(msgpack)
    await expect.poll(panel.detail).toContain('"ok"')
    expect(await panel.detail()).toContain("256")

    await panel.select(cbor)
    await expect.poll(panel.detail).toContain("Response · 1 byte")
    expect(await panel.detail()).toContain("2023-11-14T22:13:20.000Z")
  } finally {
    await panel.close()
  }
})

const userProto = `
syntax = "proto3";
package example;
enum Role { ROLE_UNKNOWN = 0; ADMIN = 1; }
message GetUserRequest { string name = 1; int32 id = 2; }
message User { Role role = 1; string name = 2; repeated int32 scores = 3; }
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(GetUserRequest) returns (stream User);
}
`

test(".proto schemas name gRPC-web fields", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/grpc`)
    const unary = "GetUser example.UserService grpc-web"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([unary]))
    await panel.select(unary)
    await expect.poll(panel.detail).toContain("Response · OK")
    expect(await panel.detail()).not.toContain("scores")

    await panel.addSchema("user.proto", userProto)
    await expect
      .poll(() => panel.text("[data-schemas]"))
      .toContain("user.proto")
    await expect.poll(panel.detail).toContain("scores")
    const detail = await panel.detail()
    for (const text of ["name", "id", "role", '"ADMIN"', "150", '"abc"'])
      expect(detail).toContain(text)

    await panel.select("ListUsers example.UserService grpc-web")
    await expect.poll(panel.detail).toContain("message 1")
    expect(await panel.detail()).toContain("role")

    await panel.addSchema("bad.proto", "message {")
    await expect
      .poll(() => panel.text("[data-schemas]"))
      .toContain("bad.proto:1:")
    expect(await panel.text("[data-schemas] ul")).not.toContain("bad.proto")

    await panel.click('button[aria-label="Remove user.proto"]')
    await panel.select(unary)
    await expect.poll(panel.detail).toContain("Response · OK")
    expect(await panel.detail()).not.toContain("scores")
  } finally {
    await panel.close()
  }
})

test("binary socket frames decode by protocol or Decode as", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/socket`)
    await expect.poll(panel.probed).toBe(true)
    const titles = async () =>
      (await panel.messages()).map((r) => r.replace(/^\+\S+ /, ""))

    await panel.page.click("#mp")
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining([expect.stringMatching(/^\/mp msgpack/)]))
    await panel.selectStarting("/mp ")
    await panel.openTab("Messages")
    await expect
      .poll(titles)
      .toEqual(['↑ {"a":1} msgpack 4 B', '↓ {"a":1} msgpack 4 B'])
    await panel.press("Home", "Messages")
    await expect.poll(panel.detail).toContain("Message 1")
    expect(await panel.detail()).toMatch(/\ba\b/)

    await panel.page.click("#bin")
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining([expect.stringMatching(/^\/bin live/)]))
    await panel.selectStarting("/bin ")
    await panel.openTab("Messages")
    await expect.poll(titles).toEqual(["↑ binary 4 B 4 B", "↓ binary 4 B 4 B"])
    await panel.press("Home", "Messages")
    await expect.poll(panel.detail).toContain("00000000  a1 61 61 01")
    await panel.stubClipboard()
    await panel.click('[aria-label="Copy Message 1"]')
    expect(await panel.copied()).toBe("oWFhAQ==")

    await panel.selectOption('select[aria-label="Decode as"]', "cbor")
    await expect
      .poll(titles)
      .toEqual(['↑ {"a":1} cbor 4 B', '↓ {"a":1} cbor 4 B'])
  } finally {
    await panel.close()
  }
})

test("the Body tab previews images and fonts and dumps other binary", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/media`)
    await expect.poll(panel.rows).toContain("/media GET")
    await panel.unhide("assets")
    const rows = ["png", "svg", "font", "badfont", "bin"].map(
      (r) => `/api/${r} GET`,
    )
    await expect.poll(panel.rows).toEqual(expect.arrayContaining(rows))
    const body = async (row: string) => {
      await panel.select(row)
      await panel.openTab("Body")
    }

    await body("/api/png GET")
    await expect.poll(panel.detail).toContain("3 × 2 px · 73 B")
    await panel.stubClipboard()
    await panel.clickButton("Copy")
    expect(await panel.copied()).toBe(PNG_BASE64)

    await body("/api/svg GET")
    await expect.poll(panel.detail).toContain("4 × 5 px")
    expect(await panel.detail()).toContain("<svg")

    await body("/api/font GET")
    await expect
      .poll(async () => (await panel.detail())?.split("quick brown fox").length)
      .toBe(4)

    await body("/api/badfont GET")
    await expect.poll(panel.detail).toContain("font failed to load")

    await body("/api/bin GET")
    await expect.poll(panel.detail).toContain("00000000  00 ff 10 41")
  } finally {
    await panel.close()
  }
})

test("filter chips narrow by protocol and status", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/filters`)
    await expect.poll(async () => (await panel.rows()).length).toBe(5)
    expect(await panel.chips()).toEqual([
      "graphql",
      "json",
      "other",
      "2xx",
      "4xx",
    ])
    const a = "A query graphql"
    const b = "B query 400 graphql"
    const users = "/api/users/1 GET json"

    const chip = 'fieldset[aria-label="Filters"] button'
    const offBackground = await panel.style(chip, "background-color")
    await panel.toggleChip("graphql")
    await expect.poll(async () => (await panel.rows()).sort()).toEqual([a, b])
    expect(await panel.style(chip, "background-color")).not.toBe(offBackground)
    expect(await panel.text("footer [data-count]")).toBe("2 of 5")

    await panel.toggleChip("json")
    await expect
      .poll(async () => (await panel.rows()).sort())
      .toEqual([users, a, b])

    await panel.toggleChip("json")
    await panel.toggleChip("4xx")
    await expect.poll(panel.rows).toEqual([b])

    await panel.toggleChip("4xx")
    await panel.search("gql-ok")
    await expect.poll(panel.rows).toEqual([a])

    await panel.clearSearch()
    await panel.toggleChip("graphql")
    await panel.toggleChip("json")
    await panel.toggleChip("4xx")
    await expect.poll(panel.rows).toEqual([])
    expect(await panel.text("main")).toMatch(
      /Your workspace is hiding \d+ requests/,
    )
    expect(await panel.text("main")).toContain("Show all")
    await panel.clickButton("Clear filters")
    await expect.poll(async () => (await panel.rows()).length).toBe(5)
    expect(await panel.pressedChips()).toEqual([])
    expect(await panel.text("[data-hide] > button")).toBe("Hide")
    const stored = JSON.parse(
      (await panel.storageItem("snapql.workspaces")) ?? "",
    )
    expect(Object.values(stored.workspaces[0].hide)).toEqual([
      false,
      false,
      false,
    ])

    await panel.clear()
    await expect.poll(panel.chips).toEqual([])
  } finally {
    await panel.close()
  }
})

test("search bodies matches request and response body text", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/filters`)
    await expect.poll(async () => (await panel.rows()).length).toBe(5)
    const toggle = bodiesToggle
    const input = "input[type=search]"
    const users = "/api/users/1 GET json"
    const geo =
      '/api/users/1 response (1): …ofile":{"address":{"geo":{"lat":1}}}} json'
    expect(await panel.text(toggle)).toBe("Include bodies")
    expect(await panel.attr(toggle, "title")).toBe(
      "Also match text inside request and response bodies. Matches show an excerpt in the list.",
    )
    expect(await panel.style(toggle, "box-shadow")).not.toBe("none")
    expect(await panel.attr(input, "placeholder")).toBe("Filter requests")

    await panel.search("geo")
    await expect.poll(panel.rows).toEqual([])

    const offColor = await panel.style(toggle, "color")
    await panel.click(toggle)
    expect(await panel.attr(toggle, "aria-pressed")).toBe("true")
    expect(await panel.style(toggle, "color")).not.toBe(offColor)
    expect(await panel.attr(input, "placeholder")).toBe(
      "Filter requests and bodies",
    )
    await expect.poll(panel.rows).toEqual([geo])
    expect(await panel.text('[aria-label="Requests"] mark')).toBe("geo")
    expect(await panel.text("footer [data-count]")).toBe("1 of 5")

    // The URL match keeps its detail; the page's own script is a body match.
    await panel.search("users")
    await expect
      .poll(panel.rows)
      .toEqual([
        users,
        '/filters response (1): …{ b }") fetch("/api/users/1") fetch("/api/missing") </script>',
      ])

    // Quoted as JSON, so the /filters document's own script doesn't match.
    await panel.search('"query":"query B')
    await expect
      .poll(panel.rows)
      .toEqual(['B request (1): {"query":"query B { b }"} 400 graphql'])

    await panel.search("geo")
    await panel.page.evaluate(() => fetch("/api/users/1"))
    await expect.poll(panel.rows).toEqual([geo, geo])
    expect(await panel.text("footer [data-count]")).toBe("2 of 6")

    await panel.click(toggle)
    await expect.poll(panel.rows).toEqual([])
    expect(await panel.attr(input, "placeholder")).toBe("Filter requests")
  } finally {
    await panel.close()
  }
})

test("Body tab highlights body search matches", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/filters`)
    await expect.poll(async () => (await panel.rows()).length).toBe(5)
    await panel.click(bodiesToggle)
    await panel.search("lat")
    await expect.poll(async () => (await panel.rows()).length).toBe(1)
    await panel.selectStarting("/api/users/1")
    await panel.openTab("Body")

    // lat sits under geo, at a depth that starts collapsed.
    await expect.poll(panel.marks).toEqual(["lat"])
    expect(await panel.detail()).toContain("lat")

    await panel.clearSearch()
    await expect.poll(panel.marks).toEqual([])
    expect(await panel.detail()).not.toContain("lat")
  } finally {
    await panel.close()
  }
})

test("Body tab highlights text bodies and scrolls to clipped matches", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/search`)
    await expect.poll(async () => (await panel.rows()).length).toBe(5)
    await panel.click(bodiesToggle)

    await panel.search("apple")
    await expect
      .poll(panel.rows)
      .toEqual(["/api/fruit response (3): apple, apple pie, apple tart"])
    await panel.search("plum")
    await expect.poll(panel.rows).toEqual(["/api/order request (1): plum"])

    await panel.search("pearl")
    await expect
      .poll(panel.rows)
      .toEqual(["/api/note response (1): a hidden pearl"])
    await panel.select("/api/note response (1): a hidden pearl")
    await panel.openTab("Body")
    await expect.poll(panel.marks).toEqual(["pearl"])

    // Past the 200-character clip, at the end of a long body.
    await panel.search("needle")
    await panel.selectStarting("/api/long")
    await panel.openTab("Body")
    await expect.poll(panel.marks).toEqual(["needle"])
    expect(await panel.scrollTop('[role="tabpanel"]')).toBeGreaterThan(0)
    // The toolbar stays put while the body scrolls under it.
    expect(await panel.inView("[data-match-nav]")).toBe(true)
    expect(
      await panel.inView('[role="tabpanel"] button[aria-label="Copy"]'),
    ).toBe(true)
  } finally {
    await panel.close()
  }
})

test("selecting a body match opens the tab that shows it", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/search`)
    await expect.poll(async () => (await panel.rows()).length).toBe(5)
    await panel.click(bodiesToggle)

    await panel.search("plum")
    const order = "/api/order request (1): plum"
    await expect.poll(panel.rows).toEqual([order])
    await panel.select(order)
    await expect.poll(panel.activeTab).toBe("Raw")
    await expect.poll(panel.marks).toEqual(["plum"])

    await panel.search("apple")
    await expect.poll(async () => (await panel.rows()).length).toBe(1)
    await panel.selectStarting("/api/fruit")
    await expect.poll(panel.activeTab).toBe("Body")

    // A URL match keeps whatever tab was open.
    await panel.openTab("Raw")
    await panel.search("fruit")
    await panel.select("/api/fruit GET")
    expect(await panel.activeTab()).toBe("Raw")
  } finally {
    await panel.close()
  }
})

test("steps through body matches", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/search`)
    await expect.poll(async () => (await panel.rows()).length).toBe(5)
    await panel.click(bodiesToggle)
    await panel.search("apple")
    await expect.poll(async () => (await panel.rows()).length).toBe(1)
    await panel.selectStarting("/api/fruit")
    const nav = "[data-match-nav]"
    const next = 'button[aria-label="Next match (Enter)"]'

    await expect.poll(() => panel.text(nav)).toBe("Match 1 of 3")
    expect(await panel.text("mark[data-current]")).toBe("apple")
    expect(await panel.count("mark[data-current]")).toBe(1)
    expect(
      await panel.style("mark[data-current]", "background-color"),
    ).not.toBe(
      await panel.style(
        '[role="tabpanel"] mark:not([data-current])',
        "background-color",
      ),
    )

    await panel.click(next)
    await panel.click(next)
    expect(await panel.text(nav)).toBe("Match 3 of 3")
    await panel.click(next)
    expect(await panel.text(nav)).toBe("Match 1 of 3")
    await panel.click('button[aria-label="Previous match (Shift+Enter)"]')
    expect(await panel.text(nav)).toBe("Match 3 of 3")
    expect(await panel.count("mark[data-current]")).toBe(1)

    await panel.pressSearch("Enter")
    expect(await panel.text(nav)).toBe("Match 1 of 3")
    await panel.pressSearch("Enter")
    expect(await panel.text(nav)).toBe("Match 2 of 3")
    await panel.pressSearch("Enter", { shift: true })
    await panel.pressSearch("Enter", { shift: true })
    expect(await panel.text(nav)).toBe("Match 3 of 3")

    await panel.search("zzz")
    await expect.poll(() => panel.count(nav)).toBe(0)
  } finally {
    await panel.close()
  }
})

test("a long socket subprotocol never scrolls the panes sideways", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/socket`)
    await expect.poll(panel.probed).toBe(true)
    await panel.page.click("#long")
    await expect
      .poll(async () => (await panel.rows()).some((r) => r.startsWith("/long")))
      .toBe(true)
    await panel.selectStarting("/long")
    await expect.poll(panel.activeTab).toBe("Summary")
    expect(
      await panel.overflowing('[aria-label="Requests"], [role="tabpanel"]'),
    ).toEqual([])
    // The title keeps its room: not truncated in the row, one line in the heading.
    expect(
      await panel.overflowing('[aria-label="Requests"] [role="option"] > span'),
    ).not.toContain("/long")
    const titleHeight = await panel.style(
      '[role="tabpanel"] header > div > span',
      "height",
    )
    expect(Number.parseFloat(titleHeight)).toBeLessThan(30)
  } finally {
    await panel.close()
  }
})

test("Copy as copies cURL and fetch, not for sockets", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/filters`)
    await panel.stubClipboard()
    const a = "A query graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([a]))
    await panel.select(a)

    await panel.clickButton("Copy as")
    expect(await panel.text('[role="menu"]')).toBe("cURL fetch")
    await panel.clickButton("cURL")
    const curl = (await panel.copied()) ?? ""
    expect(curl.startsWith(`curl '${panel.origin}/api/gql-ok'`)).toBe(true)
    expect(curl).toContain("-H 'content-type: application/json'")
    expect(curl).toContain(`--data-raw '{"query":"query A { a }"}'`)
    expect(curl).not.toContain("accept-encoding")
    expect(await panel.text('[role="menu"]')).toBeNull()
    expect(await panel.text('header button[aria-haspopup="menu"]')).toBe(
      "Copied",
    )

    await panel.clickButton("Copied")
    await panel.clickButton("fetch")
    expect(
      (await panel.copied())?.startsWith(
        `await fetch("${panel.origin}/api/gql-ok", `,
      ),
    ).toBe(true)

    await panel.page.goto(`${panel.origin}/socket`)
    await expect.poll(panel.probed).toBe(true)
    await panel.page.click("#open")
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining([expect.stringMatching(/^\/sock /)]))
    await panel.selectStarting("/sock ")
    expect(await panel.text('header button[aria-haspopup="menu"]')).toBeNull()
  } finally {
    await panel.close()
  }
})

test("Export HAR downloads the visible requests", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/filters`)
    await expect.poll(async () => (await panel.rows()).length).toBe(5)
    await panel.stubDownload()
    const exportHar = 'button[aria-label="Export HAR"]'
    type Har = {
      log: {
        version: string
        entries: {
          request: { url: string; postData?: { text: string } }
          response: { content: { text?: string } }
        }[]
      }
    }
    const har = async (i: number) => {
      const all = await panel.downloads()
      expect(all).toHaveLength(i + 1)
      return { name: all[i].name, log: (JSON.parse(all[i].text) as Har).log }
    }
    const entry = (log: Har["log"], path: string) =>
      log.entries.find((e) => new URL(e.request.url).pathname === path)

    await panel.click(exportHar)
    expect(await panel.text("[data-export]")).toBe(
      "Export 5 requests Redact secrets Download",
    )
    await panel.clickButton("Download")
    await expect.poll(async () => (await panel.downloads()).length).toBe(1)
    const full = await har(0)
    expect(full.name).toMatch(/^snapql-127\.0\.0\.1-\d{8}-\d{6}\.har$/)
    expect(full.log.version).toBe("1.2")
    expect(full.log.entries).toHaveLength(5)
    expect(full.log.entries[0].request.url).toMatch(/\/filters$/)
    expect(entry(full.log, "/api/users/1")?.response.content.text).toContain(
      '"bio"',
    )
    expect(entry(full.log, "/api/gql-ok")?.request.postData?.text).toBe(
      '{"query":"query A { a }"}',
    )
    expect(await panel.text("[data-export]")).toBeNull()

    await panel.toggleChip("graphql")
    await panel.click(exportHar)
    await panel.clickButton("Download")
    await expect.poll(async () => (await panel.downloads()).length).toBe(2)
    const filtered = await har(1)
    expect(
      // Fetched in parallel, so their start order varies.
      filtered.log.entries.map((e) => new URL(e.request.url).pathname).sort(),
    ).toEqual(["/api/gql-bad", "/api/gql-ok"])
  } finally {
    await panel.close()
  }
})

test("Export HAR redacts secrets unless unchecked", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/secrets`)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining([expect.stringMatching(/^\/api\/login/)]))
    await panel.stubDownload()
    const box = "[data-export] input[type=checkbox]"
    type Pair = { name: string; value: string }
    type Login = {
      request: {
        url: string
        headers: Pair[]
        queryString: Pair[]
        postData: { text: string }
      }
      response: { headers: Pair[]; content: { text: string } }
    }
    const login = async (i: number) => {
      await expect
        .poll(async () => (await panel.downloads()).length)
        .toBe(i + 1)
      const har = JSON.parse((await panel.downloads())[i].text)
      return har.log.entries.find((e: Login) =>
        e.request.url.includes("/api/login"),
      ) as Login
    }
    const header = (pairs: Pair[], name: string) =>
      pairs.find((p) => p.name.toLowerCase() === name)?.value

    await panel.click('button[aria-label="Export HAR"]')
    expect(await panel.checked(box)).toBe(true)
    await panel.clickButton("Download")
    const redacted = await login(0)
    const R = "[redacted]"
    for (const name of ["authorization", "x-api-key", "cookie"])
      expect(header(redacted.request.headers, name), name).toBe(R)
    expect(header(redacted.response.headers, "set-cookie")).toBe(R)
    expect(header(redacted.request.queryString, "token")).toBe(R)
    expect(header(redacted.request.queryString, "x")).toBe("1")
    expect(redacted.request.url).toContain(`token=${R}&x=1`)
    expect(redacted.request.postData.text).toBe(`password=${R}&user=ada`)
    expect(JSON.parse(redacted.response.content.text)).toEqual({
      user: { secret: R, name: "Ada" },
      note: R,
    })

    await panel.click('button[aria-label="Export HAR"]')
    await panel.click(box)
    expect(await panel.checked(box)).toBe(false)
    await panel.clickButton("Download")
    const verbatim = await login(1)
    expect(header(verbatim.request.headers, "authorization")).toMatch(
      /^Bearer [\w-]+\.[\w-]+\.sig$/,
    )
    expect(verbatim.request.url).toContain("token=abc")
  } finally {
    await panel.close()
  }
})

test("Hide menu drops preflights, cached responses and static assets by default", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/noise`)
    const noise = [
      "/api/preflight OPTIONS",
      "/api/etag GET",
      "/static/dot.png GET",
      "/static/site.css GET",
    ]
    const cached = async () =>
      (await panel.rows()).filter((r) => r === "/api/cached GET").length
    await expect.poll(panel.rows).toContain("/api/one GET")
    await expect.poll(cached).toBe(1)
    for (const row of noise) expect(await panel.rows()).not.toContain(row)

    const button = "[data-hide] > button"
    expect(await panel.text(button)).toBe("Hide (3)")
    expect(await panel.attr(button, "aria-expanded")).toBe("false")
    expect(await panel.text("footer [data-count]")).toMatch(/^\d+ of \d+$/)
    await panel.click(button)
    expect(await panel.text("[data-hide-menu]")).toBe(
      "Preflights Cached Static assets",
    )
    const toggle = (value: string) =>
      panel.click(`[data-hide-menu] input[value="${value}"]`)

    await toggle("preflights")
    expect(await panel.rows()).toContain("/api/preflight OPTIONS")
    expect(await panel.text(button)).toBe("Hide (2)")

    await toggle("cached")
    expect(await panel.rows()).toContain("/api/etag GET")
    expect(await cached()).toBe(2)

    await toggle("assets")
    expect(await panel.rows()).toEqual(expect.arrayContaining(noise))
    expect(await panel.text(button)).toBe("Hide")
    expect(await panel.text("footer [data-count]")).toMatch(/^\d+ requests$/)

    await toggle("preflights")
    expect(await panel.rows()).not.toContain("/api/preflight OPTIONS")
    expect(await panel.rows()).toContain("/api/one GET")
  } finally {
    await panel.close()
  }
})

test("Hide menu closes on Escape or a click outside", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/noise`)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/one GET"]))
    const button = "[data-hide] > button"
    const menu = "[data-hide-menu]"
    const box = `${menu} input[value="cached"]`

    await panel.click(button)
    await panel.click(box)
    expect(await panel.count(menu)).toBe(1)
    await panel.dispatch(box, "keydown", "Escape")
    expect(await panel.count(menu)).toBe(0)
    expect(await panel.focused(button)).toBe(true)

    await panel.click(button)
    await panel.dispatch(box, "pointerdown")
    expect(await panel.count(menu)).toBe(1)
    await panel.dispatch('[aria-label="Requests"]', "pointerdown")
    expect(await panel.count(menu)).toBe(0)
  } finally {
    await panel.close()
  }
})

test("filters persist across panel reloads and sites", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/filters`)
    await expect.poll(panel.chips).toContain("graphql")
    await panel.toggleChip("graphql")
    await panel.unhide("assets")

    await panel.reloadPanel()
    await panel.page.goto(`${panel.origin}/noise`)
    await expect.poll(panel.chips).toContain("other")
    expect(await panel.pressedChips()).toEqual(["graphql"])
    expect(await panel.text("[data-hide] > button")).toBe("Hide (2)")

    const stored = JSON.parse(
      (await panel.storageItem("snapql.workspaces")) ?? "",
    )
    const active = stored.workspaces.find(
      (w: { id: string }) => w.id === stored.active,
    )
    expect(active.filters.kinds).toEqual(["graphql"])
    expect(active.hide.assets).toBe(false)
  } finally {
    await panel.close()
  }
})

test("Show all bypasses the workspace until reopened", async () => {
  const panel = await openPanel()
  try {
    const active = async () => {
      const stored = JSON.parse(
        (await panel.storageItem("snapql.workspaces")) ?? "",
      )
      return stored.workspaces.find(
        (w: { id: string }) => w.id === stored.active,
      )
    }
    await panel.page.goto(`${panel.origin}/filters`)
    await expect.poll(panel.chips).toContain("4xx")
    await panel.toggleChip("4xx")
    await panel.page.goto(`${panel.origin}/noise`)
    await expect
      .poll(() => panel.text("main"))
      .toMatch(/Your workspace is hiding/)

    await panel.clickButton("Show all")
    await expect
      .poll(panel.rows)
      .toEqual(
        expect.arrayContaining([
          "/api/preflight OPTIONS",
          "/static/dot.png GET",
        ]),
      )
    expect(await panel.pressedChips()).toEqual([])
    expect(await panel.text("[data-hide] > button")).toBe("Hide")
    expect(await panel.text("[data-showing-all]")).toBe("Showing all")
    expect((await active()).filters.statuses).toEqual(["4xx"])
    expect(Object.values((await active()).hide)).toEqual([true, true, true])

    await panel.click("[data-showing-all]")
    expect(await panel.count("[data-showing-all]")).toBe(0)
    expect(await panel.pressedChips()).toEqual(["4xx"])

    await panel.clickButton("Show all")
    await panel.click("[data-hide] > button")
    await panel.click('[data-hide-menu] input[value="cached"]')
    expect(await panel.count("[data-showing-all]")).toBe(0)
    expect(await panel.text("[data-hide] > button")).toBe("Hide (1)")
    expect(await panel.pressedChips()).toEqual([])
    expect(await active()).toMatchObject({
      filters: { statuses: [] },
      hide: { preflights: false, cached: true, assets: false },
    })

    await panel.toggleChip("2xx")
    await panel.reloadPanel()
    await panel.page.goto(`${panel.origin}/noise`)
    await expect.poll(panel.chips).toContain("other")
    expect(await panel.count("[data-showing-all]")).toBe(0)
    expect(await panel.pressedChips()).toEqual(["2xx"])
  } finally {
    await panel.close()
  }
})

test("workspaces switch, create, rename and delete", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/filters`)
    await expect.poll(panel.chips).toContain("graphql")
    const button = "[data-workspace] > button"
    expect(await panel.text(button)).toBe("Default")
    expect(await panel.attr(button, "aria-haspopup")).toBe("menu")
    await panel.click(button)
    const item = '[data-workspace-menu] [role="menuitemradio"]'
    expect(await panel.text(item)).toBe("Default")
    expect(await panel.attr(item, "aria-checked")).toBe("true")

    const input = "[data-workspace-name]"
    const pick = async (name: string) => {
      await panel.click(button)
      await panel.clickButton(name)
    }
    const rename = async (value: string, end: "Enter" | "Escape" | "blur") => {
      await panel.click(button)
      await panel.clickButton("Rename")
      await panel.fill(input, value)
      if (end === "blur") await panel.dispatch(input, "blur")
      else await panel.dispatch(input, "keydown", end)
    }

    await panel.clickButton("New workspace")
    expect(await panel.count(input)).toBe(1)
    expect(await panel.focused(input)).toBe(true)
    await panel.dispatch(input, "keydown", "Enter")
    expect(await panel.count(input)).toBe(0)
    expect(await panel.text(button)).toBe("Workspace 2")

    await panel.toggleChip("graphql")
    await pick("Default")
    expect(await panel.pressedChips()).toEqual([])
    await pick("Workspace 2")
    expect(await panel.pressedChips()).toEqual(["graphql"])

    await rename("GraphQL", "Enter")
    expect(await panel.text(button)).toBe("GraphQL")
    await rename("   ", "Enter")
    expect(await panel.text(button)).toBe("GraphQL")
    await rename("X", "Escape")
    expect(await panel.text(button)).toBe("GraphQL")
    await rename("API", "blur")
    expect(await panel.text(button)).toBe("API")

    await panel.click(button)
    expect(await panel.text("[data-workspace-menu]")).toContain("Delete")
    await panel.clickButton("Delete")
    expect(await panel.text(button)).toBe("Default")
    await panel.click(button)
    expect(await panel.count(item)).toBe(1)
    expect(await panel.text("[data-workspace-menu]")).not.toContain("Delete")
  } finally {
    await panel.close()
  }
})

test("a long workspace name truncates and the empty state says how to switch", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(`${panel.origin}/filters`)
    await expect.poll(panel.chips).toContain("4xx")
    const button = "[data-workspace] > button"
    const name = "My very long workspace name for GraphQL debugging sessions"
    await panel.click(button)
    await panel.clickButton("Rename")
    await panel.fill("[data-workspace-name]", name)
    await panel.dispatch("[data-workspace-name]", "keydown", "Enter")
    expect(await panel.attr(button, "title")).toBe(name)
    expect(Number.parseFloat(await panel.style(button, "width"))).toBeLessThan(
      130,
    )
    expect(await panel.style("div:has(> [data-workspace])", "height")).toBe(
      "32px",
    )

    await panel.toggleChip("4xx")
    await panel.page.goto(`${panel.origin}/noise`)
    await expect
      .poll(() => panel.text("main"))
      .toContain(
        `Using "${name}". Switch workspaces from the menu at the start of the filter row.`,
      )

    await panel.clickButton("Show all")
    expect(await panel.count("[data-showing-all]")).toBe(1)
    await panel.click(button)
    await panel.click('[data-workspace-menu] [role="menuitemradio"]')
    expect(await panel.count("[data-showing-all]")).toBe(0)
  } finally {
    await panel.close()
  }
})
