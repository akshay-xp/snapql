import { expect, test } from "vitest"
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
