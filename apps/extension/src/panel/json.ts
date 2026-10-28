import { parseJson } from "../decoders/json"
import { count } from "../decoders/text"

export const OPEN_DEPTH = 3
export const STRING_LIMIT = 200

// Text worth a tree: JSON that parses to an object or array.
export function treeValue(text: string): object | undefined {
  const value = parseJson(text)
  return typeof value === "object" && value !== null ? value : undefined
}

export function children(value: unknown): [string, unknown][] | undefined {
  if (Array.isArray(value)) return value.map((v, i) => [String(i), v])
  if (typeof value === "object" && value !== null) return Object.entries(value)
}

export function hasMatch(value: unknown, query: string): boolean {
  const q = query.toLowerCase()
  if (!q) return false
  const kids = children(value)
  if (!kids) return String(value).toLowerCase().includes(q)
  return kids.some(
    ([name, kid]) => name.toLowerCase().includes(q) || hasMatch(kid, q),
  )
}

export function sizeLabel(value: object): string {
  const array = Array.isArray(value)
  const n = Object.keys(value).length
  if (!n) return array ? "[]" : "{}"
  return array ? `[…] ${count(n, "item")}` : `{…} ${count(n, "key")}`
}

export function brackets(value: object): string {
  const n = Object.keys(value).length
  return Array.isArray(value) ? `[${n}]` : `{${n}}`
}

export const startsOpen = (depth: number, openDepth = OPEN_DEPTH) =>
  depth < openDepth

export function clip(text: string) {
  return {
    head: text.slice(0, STRING_LIMIT),
    clipped: text.length > STRING_LIMIT,
  }
}
