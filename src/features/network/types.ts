export type GraphQLRequestBody = {
  id?: string
  query?: string
  variables?: Record<string, unknown>
  operationName?: string
  extensions?: {
    persistedQuery?: unknown
  }
}

export type ParsedRequest = {
  id: string | number | null | undefined
  startDateTime: Date

  operationName: string

  payload: GraphQLRequestBody

  response: Record<string, unknown> | null

  metadata?: {
    durationMs?: number
    statusCode?: number
    hasError?: boolean
    errorMessage?: string
  }
}
