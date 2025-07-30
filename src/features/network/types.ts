export type GraphQLRequestBody = {
  id?: string
  query?: string
  variables?: Record<string, unknown>
  operationName?: string
  extensions?: {
    persistedQuery?: unknown
  }
}

export type GQLRequest = chrome.devtools.network.Request["request"] & {
  payload: GraphQLRequestBody
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

  operationName: string

  request: GQLRequest

  response: GQLResponse

  time: chrome.devtools.network.Request["time"]

  fromCache: chrome.devtools.network.Request["_fromCache"]
}
