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
