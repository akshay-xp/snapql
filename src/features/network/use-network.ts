import { useCallback, useEffect, useState } from "react"
import { parse as gqlParse } from "graphql"
import type { GraphQLRequestBody, ParsedRequest } from "./types"
import { parse } from "../../util/safe-json-parse"

const getGraphqlOperation = (body: GraphQLRequestBody): string | undefined =>
  body.operationName || undefined

const parseGraphqlQuery = (queryString: string) => {
  return gqlParse(queryString)
}

export const isGraphqlQuery = (queryString: string) => {
  try {
    return !!parseGraphqlQuery(queryString)
  } catch (_err) {
    return false
  }
}

const isParsedGraphqlRequestValid = (
  requestBody: unknown
): requestBody is GraphQLRequestBody => {
  if (typeof requestBody !== "object" || requestBody === null) return false

  const body = requestBody as GraphQLRequestBody

  const isQueryValid =
    (typeof body.query === "string" && isGraphqlQuery(body.query)) ||
    !!body.extensions?.persistedQuery

  const isVariablesValid =
    "variables" in body
      ? typeof body.variables === "object" && body.variables !== null
      : true

  return isQueryValid && isVariablesValid
}

function parseGraphqlBody(bodyText: string): GraphQLRequestBody | undefined {
  try {
    const requestBody = parse(bodyText)
    if (!isParsedGraphqlRequestValid(requestBody)) {
      throw new Error("Parsed request body is invalid")
    }
    return requestBody
  } catch (_err) {
    return undefined
  }
}

export function useNetwork() {
  const [parsedRequests, setParsedRequests] = useState<ParsedRequest[]>([])

  useEffect(() => {
    const handler = (req: chrome.devtools.network.Request) => {
      if (req.request.method !== "POST") {
        return
      }

      const bodyText = req.request.postData?.text
      if (!bodyText) return

      const graphqlRequestBody = parseGraphqlBody(bodyText)
      if (!graphqlRequestBody) {
        return
      }

      const operationName = getGraphqlOperation(graphqlRequestBody)
      if (!operationName) {
        return
      }

      req.getContent((data) => {
        const response = parse<Record<string, unknown> | null>(data)
        if (!response) {
          return
        }

        const parsedRequest: ParsedRequest = {
          id: req._request_id,
          startDateTime: new Date(req.startedDateTime),
          operationName,
          payload: graphqlRequestBody,
          response,
        }
        setParsedRequests((prev) => [...prev, parsedRequest])
      })
    }

    chrome.devtools.network.onRequestFinished.addListener(handler)

    return () => {
      chrome.devtools.network.onRequestFinished.removeListener(handler)
    }
  }, [])

  const resetParsedRequests = useCallback(() => {
    setParsedRequests([])
  }, [])

  return {
    parsedRequests,
    resetParsedRequests,
  }
}
