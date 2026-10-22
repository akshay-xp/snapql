import { parseJson } from "./json"
import { fileRows, multipartParts, type Part } from "./multipart"
import { count } from "./text"
import type { Decoded, Decoder } from "./types"

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
    const parts = req.requestBody && multipartParts(req.requestBody)
    if (parts) return decodeUpload(parts)
    return decodeOperations(
      req.requestBody
        ? parseJson(req.requestBody.text)
        : fromParams(new URL(req.url).searchParams),
    )
  },
  decodeResponse(text) {
    if (text.trimStart().startsWith("--")) {
      const parts = incrementalParts(text)
      if (!parts.length) return
      const { data, errors } = mergeIncremental(parts)
      return responseResult(errors, data, true, { parts: parts.length })
    }
    const res = parseJson(text) as GraphQLResponse | undefined
    if (typeof res !== "object" || res === null) return
    if (!("data" in res) && !("errors" in res)) return
    return responseResult(errorList(res.errors), res.data, "data" in res)
  },
}

type GraphQLError = { message?: unknown; path?: (string | number)[] }

type GraphQLResponse = {
  data?: unknown
  errors?: GraphQLError[]
  incremental?: {
    data?: object
    items?: unknown[]
    path?: (string | number)[]
    errors?: GraphQLError[]
  }[]
}

const errorList = (v: unknown): GraphQLError[] => (Array.isArray(v) ? v : [])

function responseResult(
  errors: GraphQLError[],
  data: unknown,
  hasData: boolean,
  extra?: object,
): Decoded {
  return {
    summary: errors.length ? count(errors.length, "error") : "no errors",
    data: {
      ...(errors.length && {
        errors: errors.map((e) => ({
          name: e.path?.join(".") || "(root)",
          value: String(e.message),
        })),
      }),
      ...(hasData && { data }),
      ...extra,
    },
  }
}

// Incremental delivery (@defer/@stream): multipart/mixed, one JSON payload per part.
function incrementalParts(text: string): GraphQLResponse[] {
  const delimiter = text
    .split(/\r?\n/)
    .find((line) => line.startsWith("--"))
    ?.trim()
  if (!delimiter) return []
  return text
    .split(delimiter)
    .map((segment) =>
      parseJson(
        segment.slice(segment.indexOf("{"), segment.lastIndexOf("}") + 1),
      ),
    )
    .filter((p): p is GraphQLResponse => typeof p === "object" && p !== null)
}

function mergeIncremental(parts: GraphQLResponse[]) {
  const data = structuredClone(parts[0].data ?? {})
  const errors: GraphQLError[] = []
  const at = (path: (string | number)[]) =>
    path.reduce<unknown>(
      (o, key) => (o as Record<string, unknown>)?.[key],
      data,
    )
  for (const part of parts) {
    errors.push(...errorList(part.errors))
    for (const item of part.incremental ?? []) {
      errors.push(...errorList(item.errors))
      const path = item.path ?? []
      if (item.items) {
        const list = at(path.slice(0, -1))
        if (Array.isArray(list)) list.push(...item.items)
      } else if (item.data) {
        const target = at(path)
        if (typeof target === "object" && target)
          Object.assign(target, item.data)
      }
    }
  }
  return { data, errors }
}

// GraphQL multipart request spec: operations JSON in a field, files beside it.
function decodeUpload(parts: Part[]): Decoded | undefined {
  const field = parts.find(
    (p) => p.name === "operations" && p.filename === undefined,
  )
  const decoded = field && decodeOperations(parseJson(field.content))
  if (!decoded) return
  return {
    summary: decoded.summary,
    data: { ...(decoded.data as object), files: fileRows(parts) },
  }
}

function decodeOperations(data: unknown): Decoded | undefined {
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
