// Hand-written instead of DOMParser so decoders run outside a browser (Vitest).

type Token = {
  kind: "open" | "close" | "empty" | "text" | "other" | "bad"
  raw: string
  name: string
}

const token =
  /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<\/?[^>]+>|<|[^<]+/g

function tokens(text: string): Token[] {
  return (text.match(token) ?? [])
    .filter((raw) => raw.trim())
    .map((raw) => ({ kind: kindOf(raw), raw, name: nameOf(raw) }))
}

function kindOf(raw: string): Token["kind"] {
  if (raw === "<") return "bad"
  if (raw[0] !== "<" || raw.startsWith("<![CDATA[")) return "text"
  if (raw[1] === "!" || raw[1] === "?") return "other"
  if (raw[1] === "/") return "close"
  return raw.endsWith("/>") ? "empty" : "open"
}

function nameOf(raw: string): string {
  return raw.match(/^<\/?([^\s/>!?]+)/)?.[1] ?? ""
}

// Unbalanced input (e.g. HTML with void tags) is returned unchanged.
export function prettyXml(text: string): string {
  const toks = tokens(text)
  const lines: string[] = []
  const open: string[] = []
  let elements = 0
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    const indent = "  ".repeat(open.length)
    if (t.kind === "bad") return text
    if (t.kind === "open" || t.kind === "empty") elements++
    if (t.kind === "close") {
      if (open.pop() !== t.name) return text
      lines.push("  ".repeat(open.length) + t.raw)
    } else if (
      t.kind === "open" &&
      toks[i + 1]?.kind === "text" &&
      toks[i + 2]?.kind === "close" &&
      toks[i + 2].name === t.name
    ) {
      lines.push(indent + t.raw + toks[i + 1].raw + toks[i + 2].raw)
      i += 2
    } else {
      lines.push(indent + t.raw)
      if (t.kind === "open") open.push(t.name)
    }
  }
  return elements && !open.length ? lines.join("\n") : text
}
