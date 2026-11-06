import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { PANEL_BUDGET, panelOverBudget } from "./budget.ts"

// Run by `pnpm release` after both builds: checks the budget, zips each
// target for its store, and zips the source AMO requires for minified code.
const { version } = JSON.parse(readFileSync("package.json", "utf8"))
const over = panelOverBudget("dist/chrome/assets", PANEL_BUDGET)
if (over) {
  console.error(over)
  process.exit(1)
}
mkdirSync("release", { recursive: true })

const fresh = (name: string) => {
  const zip = resolve("release", `snapql-${name}-${version}.zip`)
  rmSync(zip, { force: true })
  return zip
}

for (const target of ["chrome", "firefox"]) {
  const zip = fresh(target)
  // From inside dist/<target>, so manifest.json sits at the zip root as the
  // stores require; -X leaves out macOS extended attributes.
  execFileSync("zip", ["-qrX", zip, "."], { cwd: `dist/${target}` })
  console.log(`${zip} (${statSync(zip).size} bytes)`)
}

// The working tree's files that git would commit, so an uncommitted version
// bump is included and ignored files (node_modules, dist, design) are not.
const zip = fresh("source")
const root = resolve("../..")
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: root },
)
execFileSync("zip", ["-qX", zip, "-@"], { cwd: root, input: files })
console.log(`${zip} (${statSync(zip).size} bytes)`)
