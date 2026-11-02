import { describe, expect, it } from "vitest"
import { emptyExchange } from "../capture/entry"
import { assetKind } from "./asset"

const entry = (mimeType: string, resourceType?: string) => ({
  mimeType,
  exchange: { ...emptyExchange, resourceType },
})

describe("assetKind", () => {
  it("names the kind from Chrome's request type, whatever the MIME", () => {
    expect(
      [
        ["image", "x-unknown"],
        ["font", "x-unknown"],
        ["stylesheet", ""],
        ["script", "text/plain"],
        ["media", "x-unknown"],
      ].map(([type, mime]) => assetKind(entry(mime, type))),
    ).toEqual(["image", "font", "css", "js", "media"])
  })

  it("falls back to the MIME without an asset request type", () => {
    for (const [mime, kind] of [
      ["image/png", "image"],
      ["image/svg+xml", "image"],
      ["font/woff2", "font"],
      ["video/mp4", "media"],
      ["audio/mpeg", "media"],
      ["text/css; charset=utf-8", "css"],
      ["text/javascript", "js"],
      ["application/javascript", "js"],
      ["application/x-javascript", "js"],
      ["application/wasm", "wasm"],
    ]) {
      expect(assetKind(entry(mime)), mime).toBe(kind)
      expect(assetKind(entry(mime, "fetch")), mime).toBe(kind)
    }
  })

  it("leaves API calls and the page itself unclassified", () => {
    expect(assetKind(entry("x-unknown", "fetch"))).toBeUndefined()
    expect(assetKind(entry("text/html", "document"))).toBeUndefined()
    expect(assetKind(entry("application/json"))).toBeUndefined()
    expect(assetKind(entry(""))).toBeUndefined()
  })
})
