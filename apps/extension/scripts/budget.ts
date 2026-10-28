import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { gzipSync } from "node:zlib"

// The panel loads every time DevTools opens, so its size is capped. Raise it
// only deliberately, noting why in docs/build.md.
export const PANEL_BUDGET = 40960

export function panelOverBudget(
  assetsDir: string,
  limit: number,
): string | undefined {
  const file = readdirSync(assetsDir).find(
    (name) => name.startsWith("panel-") && name.endsWith(".js"),
  )
  if (!file) return `no panel-*.js in ${assetsDir}`
  // Level 9, as `gzip -9c` measures it.
  const bytes = gzipSync(readFileSync(join(assetsDir, file)), {
    level: 9,
  }).length
  return bytes > limit
    ? `${file} is ${bytes} bytes gzipped, over the ${limit} budget`
    : undefined
}
