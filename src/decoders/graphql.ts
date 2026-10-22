import { parseJson } from "./json"
import { count } from "./text"
import type { Decoder } from "./types"

type GraphQLRequest = {
  query?: unknown
  operationName?: string
  variables?: unknown
  extensions?: { persistedQuery?: { sha256Hash?: unknown } }
} | null

const operationTypes = new Set(["query", "mutation", "subscription"])

export const graphql: Decoder = {
  kind: "graphql",
  decode(req) {
    const data = req.requestBody
      ? parseJson(req.requestBody.text)
      : fromParams(new URL(req.url).searchParams)
    if (!Array.isArray(data)) {
      const summary = summarize(data as GraphQLRequest)
      return summary ? { summary, data } : undefined
    }
    const ops = data as NonNullable<GraphQLRequest>[]
    const summaries = ops.map(summarize)
    if (!ops.length || !summaries.every((s) => s)) return
    const name = (i: number) => summaries[i] as string
    const operations = ops.map((op, i) => ({
      name: name(i),
      value: typeof op.query === "string" ? op.query : (apqHash(op) ?? ""),
    }))
    const variables = ops.flatMap((op, i) =>
      op.variables === undefined
        ? []
        : [{ name: name(i), value: JSON.stringify(op.variables) }],
    )
    return {
      summary: `${count(ops.length, "operation")}: ${summaries.join(", ")}`,
      data: variables.length ? { operations, variables } : { operations },
    }
  },
}

function summarize(data: GraphQLRequest): string | undefined {
  if (typeof data?.query === "string")
    return operationSummary(data.query, data.operationName)
  const hash = apqHash(data)
  if (hash === undefined) return
  return `persisted ${data?.operationName ?? hash.slice(0, 8)}`
}

function apqHash(data: GraphQLRequest): string | undefined {
  const hash = data?.extensions?.persistedQuery?.sha256Hash
  return typeof hash === "string" ? hash : undefined
}

// Strings and comments are matched first so their contents never count as braces or keywords.
const token = /"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|#[^\n]*|[{}(]|[_A-Za-z]\w*/g
const identifier = /^[_A-Za-z]/

function fromParams(params: URLSearchParams): GraphQLRequest {
  const extensions = params.get("extensions")
  return {
    ...Object.fromEntries(params),
    extensions:
      extensions === null
        ? undefined
        : (parseJson(extensions) as NonNullable<GraphQLRequest>["extensions"]),
  } as GraphQLRequest
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
