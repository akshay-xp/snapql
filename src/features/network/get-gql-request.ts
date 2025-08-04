import { safeJSONParse } from "../../util/safe-json-parse"
import { parse as gqlParse, Kind } from "graphql"
import type { GraphQLRequestBody } from "./types"

export function getGQLRequest(req: chrome.devtools.network.Request) {
  const body = getRequestBodyFromNetwork(req)
  if (!body) {
    return
  }

  const requests = getGQLRequests(body)
  if (!requests) {
    return
  }

  const mainOperation = getMainGQLOperation(requests)
  if (!mainOperation) {
    return
  }

  return {
    requests,
    operation: mainOperation.operation,
    operationName: mainOperation.operationName,
  }
}

function getRequestBodyFromNetwork(
  req: chrome.devtools.network.Request
): unknown {
  if (req.request.method === "GET") {
    return getGQLBodyFromURL(req.request.url)
  }

  return safeJSONParse(req.request.postData?.text ?? "")
}

function getGQLBodyFromURL(rawURL: string) {
  try {
    const url = new URL(rawURL)
    const query = url.searchParams.get("query")
    const operationName = url.searchParams.get("operationName")
    const variables = url.searchParams.get("variables")

    return {
      query,
      operationName,
      variables: variables ? safeJSONParse(variables) : undefined,
    }
  } catch (_err) {
    return undefined
  }
}

function getGQLRequests(body: unknown): GraphQLRequestBody[] | undefined {
  const requests: unknown[] = Array.isArray(body) ? body : [body]

  if (isGQLRequest(requests)) {
    return requests
  }

  return undefined
}

function isGQLRequest(requests: unknown[]): requests is GraphQLRequestBody[] {
  return requests.every((request) => {
    if (typeof request !== "object" || request === null) return false

    const isQueryValid =
      "query" in request &&
      typeof request.query === "string" &&
      !!parseGQLQuery(request.query)

    const isVariablesValid =
      "variables" in request ? typeof request.variables === "object" : true

    return isQueryValid && isVariablesValid
  })
}

function getMainGQLOperation(requests: GraphQLRequestBody[]) {
  if (requests.length === 0) return

  const document = parseGQLQuery(requests[0].query)
  const operationDef = document?.definitions.find(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION
  )
  const field = operationDef?.selectionSet.selections.find(
    (selection) => selection.kind === Kind.FIELD
  )

  // Prefer explicit operationName > named operation > first field name
  const operationName =
    requests[0].operationName || operationDef?.name?.value || field?.name.value
  const operation = operationDef?.operation

  if (!operationName || !operation) return

  return {
    operationName,
    operation,
  }
}

function parseGQLQuery(query: string) {
  try {
    return gqlParse(query)
  } catch (_err) {
    return undefined
  }
}
