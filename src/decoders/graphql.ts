import { parseJson } from "./json"
import { fileRows, multipartParts, type Part } from "./multipart"
import { parseStream } from "./stream"
import { count } from "./text"
import type { Decoded, DecodedResponse, Decoder } from "./types"

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
): DecodedResponse {
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
  return (parseStream("multipart/mixed", text) ?? [])
    .map((part) => parseJson(part.text))
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
    ...decoded,
    data: { ...(decoded.data as object), files: fileRows(parts) },
  }
}

function decodeOperations(data: unknown): Decoded | undefined {
  if (!Array.isArray(data)) {
    const op = label(data as GraphQLRequest)
    return op && { ...op, data }
  }
  const ops = data as NonNullable<GraphQLRequest>[]
  const labels = ops.map(label)
  if (!ops.length || !labels.every((l): l is Label => l !== undefined)) return
  const name = (i: number) => `${labels[i].detail} ${labels[i].title}`
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
    title: labels.map((l) => l.title).join(", "),
    detail: count(ops.length, "op"),
    data: variables.length ? { operations, variables } : { operations },
  }
}

type Label = { title: string; detail: string }

function label(data: GraphQLRequest): Label | undefined {
  if (typeof data?.query === "string")
    return operationLabel(data.query, data.operationName)
  const hash = apqHash(data)
  if (hash === undefined) return
  return { title: data?.operationName ?? hash.slice(0, 8), detail: "persisted" }
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

function operationLabel(
  document: string,
  operationName?: string,
): Label | undefined {
  const ops = operations(document)
  const op = ops.find((o) => o.name === operationName) ?? ops[0]
  return op && { title: op.name ?? "anonymous", detail: op.type }
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
