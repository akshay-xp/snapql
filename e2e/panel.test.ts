import { expect, test } from "vitest"
import { defaultTheme } from "../src/panel/themes"
import { openPanel } from "./harness"

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
    expect(await panel.text("footer")).toBe("0 requests")
    const empty = [
      "Waiting for requests",
      "Reload the page to capture its traffic.",
    ]
    for (const line of empty) expect(await panel.text("main")).toContain(line)
    await panel.page.evaluate(() => fetch("/api/one"))
    await expect.poll(panel.rows).toEqual(["/api/one GET"])
    for (const line of empty)
      expect(await panel.text("main")).not.toContain(line)
    expect(await panel.text("footer")).toBe("1 request")
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
    expect(await panel.text("footer")).toMatch(/^2 of \d+$/)
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
    expect(await panel.text("footer")).toMatch(/^\d+ requests$/)

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
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const row = "GetUser query graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))

    await panel.select(row)

    const detail = await panel.detail()
    expect(detail).toContain("query GetUser { user { id } }")
    expect(await panel.text('[role="tabpanel"] header')).toMatch(
      /^GetUser graphql query POST \/graphql · 200 OK · \d+ ms · \d\d:\d\d:\d\d$/,
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

    const caret = '[role="tabpanel"] button[aria-expanded]'
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
    expect(await tag()).toBe("64px")
    await panel.select("/api/one GET")
    expect(await tag()).toBe("64px")
  } finally {
    await panel.close()
  }
})

test("UI text is sans and code is monospace", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const row = "GetUser query graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))
    await panel.select(row)

    expect(await panel.style("main", "font-family")).not.toContain("monospace")
    expect(await panel.style("main", "font-size")).toBe("12px")
    expect(await panel.style('[role="tab"]', "font-family")).not.toContain(
      "monospace",
    )
    expect(await panel.style('[role="tabpanel"] pre', "font-family")).toContain(
      "monospace",
    )
    await panel.openTab("Headers")
    expect(await panel.style('[role="tabpanel"] dd', "font-family")).toContain(
      "monospace",
    )
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

test("Timing tab lists HAR phases", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const post = "GetUser query graphql"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([post]))

    await panel.select(post)
    await panel.openTab("Timing")

    expect(await panel.detail()).toMatch(/wait\s+[\d.]+ ms/)
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

test("dragging the divider resizes the detail pane", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    await expect
      .poll(panel.rows)
      .toEqual(expect.arrayContaining(["/api/two POST"]))
    await panel.press("ArrowDown")
    const { detail } = await panel.paneWidths()

    // Small enough to stay clear of the 200px minimum in the ~550px headless panel.
    await panel.dragDivider(-50)

    // The initial 50% width can be fractional; allow 1px of rounding.
    const grown = (await panel.paneWidths()).detail - detail
    expect(Math.abs(grown - 50)).toBeLessThanOrEqual(1)

    await panel.dragDivider(10_000)
    expect((await panel.paneWidths()).detail).toBe(200)
    await panel.dragDivider(-10_000)
    expect((await panel.paneWidths()).list).toBe(200)
  } finally {
    await panel.close()
  }
})

test("M3 decoders summarize their requests", async () => {
  const panel = await openPanel()
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

    await panel.select("/api/missing GET 404")
    expect(await panel.text('[role="tabpanel"] header')).toContain(
      "404 Not Found",
    )
    expect(
      await panel.style('[role="tabpanel"] header [data-status]', "color"),
    ).toBe("rgb(242, 184, 181)")

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
    ).toBe("rgb(242, 184, 181)")

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
