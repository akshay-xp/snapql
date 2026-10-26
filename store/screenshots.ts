import { mkdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { expect, test } from "vitest"
import { bodiesToggle, openPanel, type Panel } from "../e2e/harness"
import { CATALOG_PROTO, demoServer } from "./demo"

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

test("grpc", () =>
  shoot("2-grpc", async (panel) => {
    await panel.page.goto(`${panel.origin}/grpc`)
    const row = "GetProduct catalog.ProductService grpc-web"
    await expect.poll(panel.rows).toContain(row)
    await panel.addSchema("catalog.proto", CATALOG_PROTO)
    await panel.clickButton("Schemas")
    await panel.select(row)
    await panel.openTab("Response")
    await expect.poll(panel.detail).toContain("Decoded · grpc-web · OK")
    await expect.poll(panel.detail).toContain('"IN_STOCK"')
  }))

test("websocket", () =>
  shoot("3-websocket", async (panel) => {
    await panel.page.goto(`${panel.origin}/chat`)
    await expect.poll(panel.probed).toBe(true)
    await panel.page.evaluate("start()")
    await expect
      .poll(async () => (await panel.rows()).find((r) => r.startsWith("/chat")))
      .toMatch(/10 msgs/)
    await panel.selectStarting("/chat")
    await panel.openTab("Messages")
    await panel.click('[aria-label="Messages"] [role="option"]:nth-child(7)')
    await expect.poll(panel.detail).toContain("Message 7")
  }))

test("llm stream", () =>
  shoot("4-llm-stream", async (panel) => {
    await panel.page.goto(`${panel.origin}/assistant`)
    const row = "demo-chat-1 stream llm"
    await expect.poll(panel.rows).toContain(row)
    await panel.select(row)
    await panel.openTab("Response")
    await expect.poll(panel.detail).toContain("Decoded · llm · tool_calls")
  }))

test("search", () =>
  shoot("5-search", async (panel) => {
    await panel.page.goto(panel.origin)
    await expect.poll(panel.rows).toContain("BookSeat mutation graphql")
    await panel.click(bodiesToggle)
    await panel.search("JFK")
    await panel.toggleChip("graphql")
    await expect
      .poll(async () => (await panel.rows()).length)
      .toBeGreaterThan(1)
    // Rows show the match while searching, so their text changes.
    await panel.selectStarting("SearchFlights")
    await expect
      .poll(async () => (await panel.marks()).length)
      .toBeGreaterThan(0)
  }))
