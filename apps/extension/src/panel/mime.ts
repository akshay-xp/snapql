import { baseMime } from "../decoders/text"

// The browser's own classification, so labels and previews agree with what
// Chrome does: https://mimesniff.spec.whatwg.org/#mime-type-groups

const FONTS = new Set([
  "application/font-cff",
  "application/font-otf",
  "application/font-sfnt",
  "application/font-ttf",
  "application/font-woff",
  "application/vnd.ms-fontobject",
  "application/vnd.ms-opentype",
])

const JAVASCRIPT = new Set([
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
])

export const isImageMime = (mime: string) => baseMime(mime).startsWith("image/")

export const isAudioOrVideoMime = (mime: string) => {
  const base = baseMime(mime)
  return (
    base.startsWith("audio/") ||
    base.startsWith("video/") ||
    base === "application/ogg"
  )
}

export const isFontMime = (mime: string) => {
  const base = baseMime(mime)
  return base.startsWith("font/") || FONTS.has(base)
}

export const isJavaScriptMime = (mime: string) => JAVASCRIPT.has(baseMime(mime))
