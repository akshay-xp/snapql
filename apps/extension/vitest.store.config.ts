import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["store/screenshots.ts"],
    testTimeout: 60000,
  },
})
