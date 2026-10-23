import { readFileSync } from "node:fs"
import type { Plugin } from "vite"

export type Target = "chrome" | "firefox"

// Provisional until an AMO account exists.
const GECKO_ID = "snapql@akshay-xp"

const base = {
  manifest_version: 3,
  name: "SnapQL",
  description: "Inspect GraphQL requests and responses in DevTools",
  devtools_page: "devtools.html",
  icons: { "128": "128.png" },
}

export function manifestFor(target: Target, version: string) {
  const manifest = { ...base, version }
  if (target === "firefox") {
    return {
      ...manifest,
      browser_specific_settings: {
        gecko: {
          id: GECKO_ID,
          // SnapQL never sends data anywhere.
          data_collection_permissions: { required: ["none"] },
        },
      },
    }
  }
  return manifest
}

export function manifestPlugin(target: Target, version: string): Plugin {
  return {
    name: "snapql-manifest",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(manifestFor(target, version), null, 2),
      })
    },
  }
}

// Shipped unbundled and unminified: what store reviewers read is exactly what
// the panel injects into pages.
export function probePlugin(): Plugin {
  return {
    name: "snapql-probe",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "probe.js",
        source: readFileSync("src/probe/probe.js", "utf8"),
      })
    },
  }
}
