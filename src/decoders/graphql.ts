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

function operationSummary(document: string): string | undefined {
  const tokens = document.match(/[{}(]|[_A-Za-z]\w*/g) ?? []
  let depth = 0
  for (const [i, token] of tokens.entries()) {
    if (token === "{") depth++
    else if (token === "}") depth--
    else if (depth === 0 && operationTypes.has(token)) {
      return `${token} ${tokens[i + 1]}`
    }
  }
}
