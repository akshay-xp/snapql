import { useEffect, useState } from "react"

type ParsedRequest = {
  id: string | number | null | undefined
  startDateTime: Date
  payload: any
}

export function App() {
  const [parsedRequests, setParsedRequests] = useState<ParsedRequest[]>([])
  const [newestFirst, setNewestFirst] = useState<boolean>(true)

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

      const parsedRequest = {
        id: request._request_id,
        startDateTime: new Date(request.startedDateTime),
        payload,
      }
      setParsedRequests((prev) => prev.concat(parsedRequest))
    })
  }, [])

  const handleClearRequests = () => {
    setParsedRequests([])
  }

  const handleToggleSort = () => {
    setNewestFirst((prev) => !prev)
  }

  return (
    <main className="h-dvh flex">
      <aside className="w-full max-w-xs border-r border-base-200 relative">
        <ul>
          {parsedRequests
            .sort(
              (a, b) =>
                (newestFirst ? -1 : 1) *
                (a.startDateTime.getTime() - b.startDateTime.getTime())
            )
            .map((request) => (
              <li key={request.id}>
                <button className="btn btn-sm btn-block">
                  {request.payload.operationName}
                </button>
              </li>
            ))}
        </ul>
        <footer className="absolute w-full bottom-0 border-t border-base-200 p-1">
          <button className="btn btn-xs" onClick={handleClearRequests}>
            Clear
          </button>
          <button className="btn btn-xs" onClick={handleToggleSort}>
            {newestFirst ? "Newest First" : "Oldest First"}
          </button>
        </footer>
      </aside>
    </main>
  )
}
