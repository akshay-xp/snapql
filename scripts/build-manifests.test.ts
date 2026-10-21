import { describe, expect, it } from "vitest"
import { manifestFor } from "./build-manifests"

describe("manifestFor", () => {
  it("builds the Chrome manifest", () => {
    expect(manifestFor("chrome", "0.2.0")).toStrictEqual({
      manifest_version: 3,
      name: "SnapQL",
      version: "0.2.0",
      description: "Inspect GraphQL requests and responses in DevTools",
      devtools_page: "devtools.html",
      icons: { "128": "128.png" },
    })
  })
})
