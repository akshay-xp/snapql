import type { Entry } from "../capture/entry"
import { baseMime } from "../decoders/text"
import {
  isAudioOrVideoMime,
  isFontMime,
  isImageMime,
  isJavaScriptMime,
} from "./mime"

export type AssetKind = "image" | "font" | "css" | "js" | "media" | "wasm"

// Chrome's request type; it survives a failed or CORS-blocked response.
const BY_TYPE: Record<string, AssetKind> = {
  image: "image",
  font: "font",
  stylesheet: "css",
  script: "js",
  media: "media",
}

// Not spec groups, so matched exactly.
const BY_MIME: Record<string, AssetKind> = {
  "text/css": "css",
  "application/wasm": "wasm",
}

const BY_GROUP: [(mime: string) => boolean, AssetKind][] = [
  [isImageMime, "image"],
  [isFontMime, "font"],
  [isAudioOrVideoMime, "media"],
  [isJavaScriptMime, "js"],
]

export function assetKind(
  entry: Pick<Entry, "mimeType" | "exchange">,
): AssetKind | undefined {
  const type = entry.exchange.resourceType
  if (type && type in BY_TYPE) return BY_TYPE[type]
  const mime = baseMime(entry.mimeType)
  return BY_MIME[mime] ?? BY_GROUP.find(([is]) => is(mime))?.[1]
}

// The label for an undecoded entry. HTML gets one but is not an asset: the
// page or a fetched partial is often what is being debugged.
export const contentKind = (entry: Pick<Entry, "mimeType" | "exchange">) =>
  assetKind(entry) ??
  (baseMime(entry.mimeType) === "text/html" ? "html" : undefined)
