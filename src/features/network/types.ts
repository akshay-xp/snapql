import type { OperationTypeNode } from "graphql"

export type GraphQLRequestBody = {
  query: string
  variables?: Record<string, unknown>
  operationName: string
}

export type GQLRequest = chrome.devtools.network.Request["request"] & {
  data: GraphQLRequestBody[]
}

export type GQLResponse = chrome.devtools.network.Request["response"] & {
  data: Record<string, unknown> | null
  /**
   * set to true if the response is from service worker, false otherwise.
   * not included in the chromes official typescript typings.
   */
  _fetchedViaServiceWorker?: boolean
}

export type ParsedRequest = {
  id: string | number | null | undefined
  startDateTime: Date

  operation: OperationTypeNode
  operationName: string

  request: GQLRequest

  response: GQLResponse

  time: chrome.devtools.network.Request["time"]

  fromCache: chrome.devtools.network.Request["_fromCache"]
}
