import { useCallback, useEffect, useState } from "react"
import type { ParsedRequest } from "./types"

export function useNetwork() {
  const [parsedRequests, setParsedRequests] = useState<ParsedRequest[]>([])

  useEffect(() => {
    chrome.devtools.network.onRequestFinished.addListener((request) => {
      if (
        request.request.method !== "POST" ||
        !request.request.postData ||
        !request.request.postData.text
      ) {
        return
      }

      const payload = JSON.parse(request.request.postData.text)
      if (
        typeof payload !== "object" ||
        payload === null ||
        typeof payload.query !== "string"
      ) {
        return
      }

      request.getContent((data) => {
        const response = JSON.parse(data)

        const parsedRequest = {
          id: request._request_id,
          startDateTime: new Date(request.startedDateTime),
          payload,
          response,
        }
        setParsedRequests((prev) => prev.concat(parsedRequest))
      })
    })
  }, [])

  const resetParsedRequests = useCallback(() => {
    setParsedRequests([])
  }, [])

  return {
    parsedRequests,
    resetParsedRequests,
  }
}
