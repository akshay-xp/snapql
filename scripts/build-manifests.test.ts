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

  it("builds the Firefox manifest as Chrome plus the gecko id", () => {
    const firefox = manifestFor("firefox", "0.2.0")
    const chrome = manifestFor("chrome", "0.2.0")

    expect(firefox).toStrictEqual({
      ...chrome,
      browser_specific_settings: {
        gecko: {
          id: "snapql@akshay-xp",
          data_collection_permissions: { required: ["none"] },
        },
      },
    })
    expect(chrome).not.toHaveProperty("browser_specific_settings")
  })
})
