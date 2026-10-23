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
  const panel = await openPanel({ devtoolsTheme: "dark" })
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

    await panel.dragDivider(10_000)
    expect((await panel.paneWidths()).detail).toBe(200)
    await panel.dragDivider(-10_000)
    expect((await panel.paneWidths()).list).toBe(200)
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
  } finally {
    await panel.close()
  }
})
