import type { NameValue } from "../capture/entry"

export const valueText = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2)

export const pairsText = (pairs: NameValue[]) =>
  pairs.map((p) => `${p.name} = ${p.value}`).join("\n")

// DevTools panels can block the Clipboard API, so fall back to execCommand.
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement("textarea")
    area.value = text
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.append(area)
    area.select()
    document.execCommand("copy")
    area.remove()
  }
}

// Chrome's clipboard takes only PNG images, so every format is redrawn as one
// (a GIF keeps its first frame).
function pngBlob(src: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext("2d")?.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("no PNG"))),
        "image/png",
      )
    }
    img.onerror = () => reject(new Error("image failed to load"))
    img.src = src
  })
}

// The blob goes in as a promise, so the write starts inside the click and
// keeps its user activation.
export const copyImage = (src: string) =>
  navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob(src) })])
