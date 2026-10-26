import { mkdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { expect, test } from "vitest"
import { openPanel, type Panel } from "../e2e/harness"
import { demoServer } from "./demo"

// The store's 1280x800 screenshots, in listing order. Run with
// `pnpm screenshots`; each shot waits for its content, so a failed render
// fails the run instead of writing a blank image.

const out = resolve(import.meta.dirname, "screenshots")
const size = { width: 1280, height: 800 }

async function shoot(name: string, setup: (panel: Panel) => Promise<void>) {
  await mkdir(out, { recursive: true })
  const panel = await openPanel({
    server: demoServer(),
    size,
    devtoolsTheme: "dark",
  })
  try {
    await setup(panel)
    const file = join(out, `${name}.png`)
    await panel.screenshot(file)
    const png = await readFile(file)
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([
      size.width,
      size.height,
    ])
  } finally {
    await panel.close()
  }
}

test("graphql", () =>
  shoot("1-graphql", async (panel) => {
    await panel.page.goto(panel.origin)
    const row = "SearchFlights query graphql"
    await expect.poll(panel.rows).toContain(row)
    await panel.select(row)
    await panel.openTab("Payload")
    await expect.poll(panel.detail).toContain("Decoded · graphql")
  }))
