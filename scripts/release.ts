import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { PANEL_BUDGET, panelOverBudget } from "./budget.ts"

// Run by `pnpm release` after a Chrome build: checks the budget and zips
// dist/chrome for the Web Store upload.
const { version } = JSON.parse(readFileSync("package.json", "utf8"))
const over = panelOverBudget("dist/chrome/assets", PANEL_BUDGET)
if (over) {
  console.error(over)
  process.exit(1)
}
mkdirSync("release", { recursive: true })
const zip = resolve("release", `snapql-chrome-${version}.zip`)
rmSync(zip, { force: true })
// From inside dist/chrome, so manifest.json sits at the zip root as the
// store requires; -X leaves out macOS extended attributes.
execFileSync("zip", ["-qrX", zip, "."], { cwd: "dist/chrome" })
console.log(`${zip} (${statSync(zip).size} bytes)`)
