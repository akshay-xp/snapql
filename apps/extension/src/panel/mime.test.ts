import { describe, expect, it } from "vitest"
import {
  isAudioOrVideoMime,
  isFontMime,
  isImageMime,
  isJavaScriptMime,
  sniffBody,
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

describe("sniffBody", () => {
  const b = (...bytes: (number | string)[]) =>
    new Uint8Array(
      bytes.flatMap((x) =>
        typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x],
      ),
    )

  it("recognises every image pattern in the spec", () => {
    for (const bytes of [
      b(0, 0, 1, 0),
      b(0, 0, 2, 0),
      b("BM"),
      b("GIF87a"),
      b("GIF89a"),
      b("RIFF", 9, 9, 9, 9, "WEBPVP"),
      b(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a),
      b(0xff, 0xd8, 0xff),
    ])
      expect(sniffBody(bytes), String(bytes)).toBe("image")
  })

  it("recognises every font pattern in the spec", () => {
    for (const bytes of [
      b(...Array(34).fill(7), "LP"),
      b(0, 1, 0, 0),
      b("OTTO"),
      b("ttcf"),
      b("wOFF"),
      b("wOF2"),
    ])
      expect(sniffBody(bytes), String(bytes)).toBe("font")
  })

  it("needs the whole pattern", () => {
    expect(sniffBody(b(0x89, "PNG", 0x0d, 0x0a, 0x1a))).toBeUndefined()
    expect(sniffBody(b('{"a":1}'))).toBeUndefined()
  })
})
