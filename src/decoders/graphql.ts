import type { Decoder } from "./types"

const operationTypes = new Set(["query", "mutation", "subscription"])

export const graphql: Decoder = {
  kind: "graphql",
  decode(req) {
    if (!req.requestBody) return
    const data = JSON.parse(req.requestBody.text)
    if (typeof data?.query !== "string") return
    const summary = operationSummary(data.query)
    return summary ? { summary, data } : undefined
  },
}

// Strings and comments are matched first so their contents never count as braces or keywords.
const token = /"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|#[^\n]*|[{}(]|[_A-Za-z]\w*/g
const name = /^[_A-Za-z]/

function operationSummary(document: string): string | undefined {
  const tokens = (document.match(token) ?? []).filter(
    (t) => t[0] !== '"' && t[0] !== "#",
  )
  let depth = 0
  for (const [i, t] of tokens.entries()) {
    if (t === "{") {
      if (depth === 0) return "query"
      depth++
    } else if (t === "}") depth--
    else if (depth === 0 && operationTypes.has(t)) {
      const next = tokens[i + 1]
      return next && name.test(next) ? `${t} ${next}` : t
    }
  }
}
