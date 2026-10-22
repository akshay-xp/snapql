import { baseMime } from "./text"
import type { Decoder, RequestView } from "./types"

type Token = {
  kind: "open" | "close" | "empty" | "text" | "other" | "bad"
  raw: string
  name: string
}

// Hand-written: decoders run outside a browser (Vitest), so no browser XML parser.
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

// Element local names in document order, or undefined when the body is not XML.
function elements(
  req: RequestView,
): { names: string[]; text: string } | undefined {
  const body = req.requestBody
  if (
    !body ||
    !(
      baseMime(body.mimeType).includes("xml") ||
      body.text.trimStart()[0] === "<"
    )
  )
    return
  const names = tokens(body.text)
    .filter((t) => t.kind === "open" || t.kind === "empty")
    .map((t) => localName(t.name))
  return names.length ? { names, text: body.text } : undefined
}

const localName = (name: string) => name.slice(name.indexOf(":") + 1)

export const xml: Decoder = {
  kind: "xml",
  decode(req) {
    const doc = elements(req)
    return doc && { summary: doc.names[0], data: { xml: prettyXml(doc.text) } }
  },
}

export const soap: Decoder = {
  kind: "soap",
  decode(req) {
    const doc = elements(req)
    if (doc?.names[0] !== "Envelope") return
    const body = doc.names.indexOf("Body")
    const operation = body > 0 ? doc.names[body + 1] : undefined
    if (!operation) return
    return { summary: operation, data: { xml: prettyXml(doc.text) } }
  },
}
