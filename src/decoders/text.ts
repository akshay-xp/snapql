// Small helpers shared by decoders.

export const baseMime = (mimeType: string) =>
  mimeType.split(";")[0].trim().toLowerCase()

export const count = (n: number, word: string) =>
  `${n} ${word}${n === 1 ? "" : "s"}`
