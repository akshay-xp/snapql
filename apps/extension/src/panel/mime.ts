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

type Pattern = [bytes: number[], mask: number[], kind: "image" | "font"]

const exact = (bytes: number[] | string): number[] =>
  typeof bytes === "string" ? [...bytes].map((c) => c.charCodeAt(0)) : bytes
const all = (n: number) => Array<number>(n).fill(0xff)
const strict = (bytes: number[] | string, kind: Pattern[2]): Pattern => {
  const pattern = exact(bytes)
  return [pattern, all(pattern.length), kind]
}

// https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern and
// #matching-a-font-type-pattern; mask 0x00 bytes are ignored.
const PATTERNS: Pattern[] = [
  strict([0, 0, 1, 0], "image"),
  strict([0, 0, 2, 0], "image"),
  strict("BM", "image"),
  strict("GIF87a", "image"),
  strict("GIF89a", "image"),
  [exact("RIFF\0\0\0\0WEBPVP"), [...all(4), 0, 0, 0, 0, ...all(6)], "image"],
  strict([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image"),
  strict([0xff, 0xd8, 0xff], "image"),
  [
    [...Array<number>(34).fill(0), 0x4c, 0x50],
    [...Array<number>(34).fill(0), 0xff, 0xff],
    "font",
  ],
  strict([0, 1, 0, 0], "font"),
  strict("OTTO", "font"),
  strict("ttcf", "font"),
  strict("wOFF", "font"),
  strict("wOF2", "font"),
]

// #pattern-matching-algorithm, without leading bytes to ignore (no image or
// font pattern has any).
const matches = (bytes: Uint8Array, [pattern, mask]: Pattern) =>
  bytes.length >= pattern.length &&
  pattern.every((p, i) => (bytes[i] & mask[i]) === p)

// The longest pattern (EOT) needs 36 bytes.
export const SNIFF_BYTES = 36

export const sniffBody = (bytes: Uint8Array) =>
  PATTERNS.find((p) => matches(bytes, p))?.[2]
