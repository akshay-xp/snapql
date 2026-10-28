import { randomBytes } from "node:crypto"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { panelOverBudget } from "./budget"

const assets = async (files: Record<string, Buffer | string>) => {
  const dir = await mkdtemp(join(tmpdir(), "snapql-budget-"))
  for (const [name, data] of Object.entries(files))
    await writeFile(join(dir, name), data)
  return dir
}

describe("panelOverBudget", () => {
  it("passes a panel bundle that gzips within the limit", async () => {
    const dir = await assets({ "panel-abc.js": "x".repeat(100_000) })
    expect(panelOverBudget(dir, 40960)).toBeUndefined()
  })

  it("names the bundle and its gzipped size when over", async () => {
    const dir = await assets({ "panel-abc.js": randomBytes(65536) })
    expect(panelOverBudget(dir, 40960)).toMatch(
      /^panel-abc\.js is \d{5} bytes gzipped, over the 40960 budget$/,
    )
  })

  it("fails when there is no panel bundle", async () => {
    const dir = await assets({ "devtools-abc.js": "" })
    expect(panelOverBudget(dir, 40960)).toBe(`no panel-*.js in ${dir}`)
  })
})
