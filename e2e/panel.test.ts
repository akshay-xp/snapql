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
