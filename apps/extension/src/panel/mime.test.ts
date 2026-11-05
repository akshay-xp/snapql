import { describe, expect, it } from "vitest"
import {
  isAudioOrVideoMime,
  isFontMime,
  isImageMime,
  isJavaScriptMime,
} from "./mime"

describe("MIME type groups", () => {
  it("matches every font MIME type in the spec", () => {
    for (const mime of [
      "font/woff2",
      "font/anything",
      "application/font-cff",
      "application/font-otf",
      "application/font-sfnt",
      "application/font-ttf",
      "application/font-woff",
      "application/vnd.ms-fontobject",
      "application/vnd.ms-opentype",
    ])
      expect(isFontMime(mime), mime).toBe(true)
    expect(isFontMime("application/x-font-ttf")).toBe(false)
  })

  it("matches every JavaScript MIME type in the spec, any case", () => {
    for (const mime of [
      "application/ecmascript",
      "application/javascript",
      "application/x-ecmascript",
      "application/x-javascript",
      "text/ecmascript",
      "text/javascript",
      "text/javascript1.0",
      "text/javascript1.1",
      "text/javascript1.2",
      "text/javascript1.3",
      "text/javascript1.4",
      "text/javascript1.5",
      "text/jscript",
      "text/livescript",
      "text/x-ecmascript",
      "text/x-javascript",
      "TEXT/JavaScript; charset=utf-8",
    ])
      expect(isJavaScriptMime(mime), mime).toBe(true)
    for (const mime of ["text/javascript2", "application/json"])
      expect(isJavaScriptMime(mime), mime).toBe(false)
  })

  it("matches images, audio and video by type", () => {
    expect(isImageMime("image/avif")).toBe(true)
    expect(isImageMime("imagex/png")).toBe(false)
    for (const mime of ["audio/mpeg", "video/mp4", "application/ogg"])
      expect(isAudioOrVideoMime(mime), mime).toBe(true)
    expect(isAudioOrVideoMime("application/json")).toBe(false)
  })
})
