import type { Entry, NameValue } from "../capture/entry"
import { parseJson } from "../decoders/json"

export type DiffLine = { op: " " | "+" | "-"; text: string }

const lines = (text: string) => (text ? text.split("\n") : [])

export function diffLines(a: string, b: string): DiffLine[] {
  const before = lines(a)
  const after = lines(b)
  // Equal ends are trimmed first: mostly-equal bodies are the common case,
  // and Myers' cost grows with the length it has to walk.
  let start = 0
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start++
  let end = 0
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end++
  const equal = (text: string): DiffLine => ({ op: " ", text })
  return [
    ...before.slice(0, start).map(equal),
    ...myers(
      before.slice(start, before.length - end),
      after.slice(start, after.length - end),
    ),
    ...before.slice(before.length - end).map(equal),
  ]
}

// Myers' O(ND) greedy forward pass, keeping each round's furthest x per
// diagonal so the path can be walked back.
function myers(a: string[], b: string[]): DiffLine[] {
  const n = a.length
  const m = b.length
  const offset = n + m + 1
  const v = new Int32Array(2 * offset + 1)
  const trace: Int32Array[] = []
  const down = (row: Int32Array, d: number, k: number) =>
    k === -d || (k !== d && row[offset + k - 1] < row[offset + k + 1])
  search: for (let d = 0; d <= n + m; d++) {
    trace.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      let x = down(v, d, k) ? v[offset + k + 1] : v[offset + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x
      if (x >= n && y >= m) break search
    }
  }
  const out: DiffLine[] = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d >= 0; d--) {
    const row = trace[d]
    const k = x - y
    const prevK = down(row, d, k) ? k + 1 : k - 1
    const prevX = row[offset + prevK]
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      y--
      out.push({ op: " ", text: a[--x] })
    }
    if (d === 0) break
    if (x === prevX) out.push({ op: "+", text: b[--y] })
    else out.push({ op: "-", text: a[--x] })
  }
  return out.reverse()
}

export type DiffSection = { name: string; lines: DiffLine[]; changed: boolean }

type Diffable = Pick<
  Entry,
  "method" | "url" | "status" | "requestBody" | "exchange"
>

// Sorted so header order, which browsers and servers vary freely, isn't a change.
const headerText = (headers: readonly NameValue[]) =>
  [...headers]
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    .map((h) => `${h.name}: ${h.value}`)
    .join("\n")

const sortKeys = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sortKeys)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
        )
      : value

// JSON key order carries no meaning, so both sides are compared sorted.
function normalize(text: string): string {
  const value = parseJson(text)
  return value === undefined ? text : JSON.stringify(sortKeys(value), null, 2)
}

export function diffSections(
  base: Diffable,
  other: Diffable,
  baseBody: string,
  otherBody: string,
): DiffSection[] {
  const parts = (e: Diffable, body: string): [string, string][] => [
    ["Request line", `${e.method} ${e.url}`],
    ["Status", `${e.status} ${e.exchange.statusText}`.trim()],
    ["Request headers", headerText(e.exchange.requestHeaders)],
    [
      "Query",
      e.exchange.queryString.map((q) => `${q.name}=${q.value}`).join("\n"),
    ],
    ["Request body", normalize(e.requestBody?.text ?? "")],
    ["Response headers", headerText(e.exchange.responseHeaders)],
    ["Response body", normalize(body)],
  ]
  const after = parts(other, otherBody)
  return parts(base, baseBody).map(([name, text], i) => {
    const lines = diffLines(text, after[i][1])
    return { name, lines, changed: lines.some((l) => l.op !== " ") }
  })
}

export function collapse(lines: DiffLine[], context = 3): DiffLine[] {
  const out: DiffLine[] = []
  let run: DiffLine[] = []
  const flush = () => {
    if (run.length > 2 * context)
      out.push(
        ...run.slice(0, context),
        { op: " ", text: `… ${run.length - 2 * context} unchanged lines` },
        ...run.slice(-context),
      )
    else out.push(...run)
    run = []
  }
  for (const line of lines) {
    if (line.op === " ") run.push(line)
    else {
      flush()
      out.push(line)
    }
  }
  flush()
  return out
}
