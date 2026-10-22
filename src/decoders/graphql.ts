import type { Decoder } from "./types"

type GraphQLRequest = {
  query?: unknown
  operationName?: string
  extensions?: { persistedQuery?: { sha256Hash?: unknown } }
} | null

const operationTypes = new Set(["query", "mutation", "subscription"])

export const graphql: Decoder = {
  kind: "graphql",
  decode(req) {
    const data: GraphQLRequest | undefined = req.requestBody
      ? parseJson(req.requestBody.text)
      : Object.fromEntries(new URL(req.url).searchParams)
    if (typeof data?.query === "string") {
      const summary = operationSummary(data.query, data.operationName)
      return summary ? { summary, data } : undefined
    }
    const hash = data?.extensions?.persistedQuery?.sha256Hash
    if (typeof hash !== "string") return
    return {
      summary: `persisted ${data?.operationName ?? hash.slice(0, 8)}`,
      data,
    }
  },
}

// Strings and comments are matched first so their contents never count as braces or keywords.
const token = /"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|#[^\n]*|[{}(]|[_A-Za-z]\w*/g
const identifier = /^[_A-Za-z]/

function parseJson(text: string): GraphQLRequest | undefined {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

type Operation = { type: string; name?: string }

function operationSummary(
  document: string,
  operationName?: string,
): string | undefined {
  const ops = operations(document)
  const op = ops.find((o) => o.name === operationName) ?? ops[0]
  return op && (op.name ? `${op.type} ${op.name}` : op.type)
}

function operations(document: string): Operation[] {
  const tokens = (document.match(token) ?? []).filter(
    (t) => t[0] !== '"' && t[0] !== "#",
  )
  const ops: Operation[] = []
  let depth = 0
  let definitionOpen = false
  for (const [i, t] of tokens.entries()) {
    if (t === "{") {
      if (depth === 0 && !definitionOpen) ops.push({ type: "query" })
      definitionOpen = false
      depth++
    } else if (t === "}") depth--
    else if (depth === 0 && t === "fragment") definitionOpen = true
    else if (depth === 0 && operationTypes.has(t)) {
      definitionOpen = true
      const next = tokens[i + 1]
      ops.push({
        type: t,
        name: identifier.test(next ?? "") ? next : undefined,
      })
    }
  }
  return ops
}
