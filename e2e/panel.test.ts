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
