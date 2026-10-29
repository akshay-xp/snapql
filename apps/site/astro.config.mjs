import { defineConfig } from "astro/config"

export default defineConfig({
  site: "https://snapql.akxp.net",
  // One small stylesheet: inlined, it no longer blocks the first paint.
  build: { inlineStylesheets: "always" },
})
