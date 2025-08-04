import { useCallback, useEffect, useState } from "react"
import { nanoid } from "nanoid"
import type { GQLRequest, GQLResponse, ParsedRequest } from "./types"
import { safeJSONParse } from "../../util/safe-json-parse"
import { getGQLRequest } from "./get-gql-request"

export function useNetwork() {
  const [parsedRequests, setParsedRequests] = useState<ParsedRequest[]>([])

  useEffect(() => {
    const handler = (req: chrome.devtools.network.Request) => {
      const gqlRequest = getGQLRequest(req)
      if (!gqlRequest) {
        return
      }

      const request = req.request as GQLRequest
      request.data = gqlRequest.requests

      const response = req.response as GQLResponse
      req.getContent((rawData) => {
        const data = safeJSONParse<Record<string, unknown> | null>(rawData)
        if (!data) {
          return
        }

        response.data = data
      })

      const parsedRequest: ParsedRequest = {
        id: nanoid(),
        startDateTime: new Date(req.startedDateTime),
        operation: gqlRequest.operation,
        operationName: gqlRequest.operationName,
        request,
        response,
        time: Math.round(req.time * 100) / 100,
        fromCache: req._fromCache,
      }
      setParsedRequests((prev) => [...prev, parsedRequest])
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
