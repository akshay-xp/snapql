import { expect, test } from "vitest"
import { defaultTheme } from "../src/panel/themes"
import { openPanel } from "./harness"

test("panel lists requests from the inspected page", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    await expect
      .poll(panel.rows)
      .toEqual(
        expect.arrayContaining([
          `GET 200 ${panel.origin}/api/one`,
          `POST 201 ${panel.origin}/api/two`,
        ]),
      )
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
      .toEqual(expect.arrayContaining([`POST 201 ${panel.origin}/api/two`]))
    await panel.clear()
    await expect.poll(panel.rows).toEqual([])
    await panel.page.evaluate(() => fetch("/api/one"))
    await expect.poll(panel.rows).toEqual([`GET 200 ${panel.origin}/api/one`])
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
          "POST 200 graphql query GetUser",
          "GET 200 graphql persisted GetUser",
          `GET 200 ${panel.origin}/api/one`,
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
      .toEqual(
        expect.arrayContaining([
          `GET 200 ${panel.origin}/api/one`,
          `POST 201 ${panel.origin}/api/two`,
        ]),
      )
  } finally {
    await panel.close()
  }
})

test("navigating clears old rows unless Preserve log is on", async () => {
  const panel = await openPanel()
  try {
    const two = `POST 201 ${panel.origin}/api/two`
    const three = `GET 200 ${panel.origin}/api/three`
    const visit = async (path: string, row: string) => {
      await panel.page.goto(panel.origin + path)
      await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))
    }

    await visit("/", two)
    await visit("/other", three)
    expect(await panel.rows()).not.toContain(two)

    await panel.togglePreserveLog()
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

test("rows select from the keyboard or by click", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const two = `POST 201 ${panel.origin}/api/two`
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
      .toEqual(expect.arrayContaining([`POST 201 ${panel.origin}/api/two`]))

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
    const row = "POST 200 graphql query GetUser"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))

    await panel.select(row)

    const detail = await panel.detail()
    expect(detail).toContain("query GetUser { user { id } }")
    expect(detail).toContain('"id": "1"')
    expect(detail).toContain(`${panel.origin}/graphql`)
  } finally {
    await panel.close()
  }
})

test("Body tab loads and pretty-prints the response", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const row = "POST 200 graphql query GetUser"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([row]))

    await panel.select(row)
    await panel.openTab("Body")

    expect(await panel.activeTab()).toBe("Body")
    await expect.poll(panel.detail).toContain('{\n  "data": {}\n}')
  } finally {
    await panel.close()
  }
})

test("Headers and Params/Cookies tabs list name/value pairs", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const post = "POST 200 graphql query GetUser"
    const apq = "GET 200 graphql persisted GetUser"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([post, apq]))

    await panel.select(post)
    await panel.openTab("Headers")
    expect(await panel.detail()).toMatch(/content-type: application\/json/i)

    await panel.select(apq)
    await panel.openTab("Params/Cookies")
    expect(await panel.detail()).toContain("operationName = GetUser")
  } finally {
    await panel.close()
  }
})

test("Timing tab lists HAR phases", async () => {
  const panel = await openPanel()
  try {
    await panel.page.goto(panel.origin)
    const post = "POST 200 graphql query GetUser"
    await expect.poll(panel.rows).toEqual(expect.arrayContaining([post]))

    await panel.select(post)
    await panel.openTab("Timing")

    expect(await panel.detail()).toMatch(/wait\s+[\d.]+ ms/)
  } finally {
    await panel.close()
  }
})
