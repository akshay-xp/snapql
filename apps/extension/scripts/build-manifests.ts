import { readFileSync } from "node:fs"
import type { Plugin } from "vite"

export type Target = "chrome" | "firefox"

// Permanent once on AMO: installs and updates are tied to it.
const GECKO_ID = "snapql@akxp.net"

const base = {
  manifest_version: 3,
  // The Web Store's title (max 75) and summary (max 132), weighted most in its
  // search. The DevTools tab title is set separately in src/devtools.ts.
  name: "SnapQL: GraphQL, REST, gRPC & WebSocket Inspector",
  description:
    "A DevTools panel that makes your app's network traffic readable, from GraphQL operations to WebSocket messages and LLM streams.",
  devtools_page: "devtools.html",
  icons: { "128": "128.png" },
}

export function manifestFor(target: Target, version: string) {
  const manifest = { ...base, version }
  if (target === "firefox") {
    return {
      ...manifest,
      // AMO caps the name at 45 characters.
      name: "SnapQL: GraphQL, gRPC & WebSocket Inspector",
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
