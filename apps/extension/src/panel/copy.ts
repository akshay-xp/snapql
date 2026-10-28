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
