// A blob link needs no downloads permission and works in both browsers' panels.
export function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url))
}
