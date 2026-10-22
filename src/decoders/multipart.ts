export type Part = {
  name: string
  filename?: string
  type?: string
  content: string
}

export function parseMultipart(text: string, boundary: string): Part[] {
  const parts: Part[] = []
  for (const segment of text.split(`--${boundary}`).slice(1)) {
    if (segment.startsWith("--")) break
    const raw = segment.replace(/^\r?\n/, "").replace(/\r?\n$/, "")
    const blank = raw.match(/\r?\n\r?\n/)
    if (!blank?.index) continue
    const headers = raw.slice(0, blank.index)
    const name = param(headers, "name")
    if (name === undefined) continue
    const filename = param(headers, "filename")
    const type = headers.match(/^content-type:\s*(.+)$/im)?.[1].trim()
    parts.push({
      name,
      ...(filename === undefined ? {} : { filename }),
      ...(type === undefined ? {} : { type }),
      content: raw.slice(blank.index + blank[0].length),
    })
  }
  return parts
}

function param(headers: string, key: string): string | undefined {
  return headers.match(new RegExp(`[;\\s]${key}="([^"]*)"`, "i"))?.[1]
}
