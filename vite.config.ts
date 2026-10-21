import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import pkg from "./package.json" with { type: "json" }
import { manifestPlugin, type Target } from "./scripts/build-manifests.ts"

const targets: Target[] = ["chrome", "firefox"]

export default defineConfig(({ mode }) => {
  if (!targets.includes(mode as Target)) {
    throw new Error(`Unknown build target "${mode}", use --mode chrome|firefox`)
  }
  const target = mode as Target

  return {
    plugins: [solid(), tailwindcss(), manifestPlugin(target, pkg.version)],
    build: {
      outDir: `dist/${target}`,
      emptyOutDir: true,
      modulePreload: { polyfill: false },
      rolldownOptions: {
        input: ["devtools.html", "panel.html"],
      },
    },
  }
})
