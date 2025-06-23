import { useEffect, useState } from "react"
import { JSONView } from "./components/json-view/json-view"
import { Ban, ClockArrowDown, ClockArrowUp, Search } from "lucide-react"

type ParsedRequest = {
  id: string | number | null | undefined
  startDateTime: Date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
  response: object
}

export function App() {
  const [parsedRequests, setParsedRequests] = useState<ParsedRequest[]>([])
  const [newestFirst, setNewestFirst] = useState<boolean>(true)
  const [selectedRequest, setSelectedRequest] = useState<ParsedRequest | null>(
    null
  )

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

  const handleClearRequests = () => {
    setParsedRequests([])
    setSelectedRequest(null)
  }

  const handleToggleSort = () => {
    setNewestFirst((prev) => !prev)
  }

  const handleSelectRequest = (selectedRequest: ParsedRequest) => {
    setSelectedRequest(selectedRequest)
  }

  return (
    <main className="grid grid-cols-[20rem_1fr] grid-rows-2 lg:grid-cols-[20rem_1fr_1fr] lg:grid-rows-none h-dvh bg-base-300">
      <aside className="row-span-full flex flex-col overflow-auto border-r border-base-100 relative bg-base-200">
        <header className="sticky top-0 w-full border-b border-base-100 p-2 bg-base-200">
          <label className="input">
            <Search />
            <input type="search" className="grow" placeholder="Search" />
            <kbd className="kbd kbd-sm">⌘</kbd>
            <kbd className="kbd kbd-sm">K</kbd>
          </label>
        </header>
        <ul className="flex-1">
          {parsedRequests
            .sort(
              (a, b) =>
                (newestFirst ? -1 : 1) *
                (a.startDateTime.getTime() - b.startDateTime.getTime())
            )
            .map((request) => (
              <li key={request.id} onClick={() => handleSelectRequest(request)}>
                <button className="btn btn-sm btn-block btn-ghost justify-start">
                  {request.payload.operationName}
                </button>
              </li>
            ))}
        </ul>
        <footer className="sticky bottom-0 w-full border-t border-base-100 p-2 bg-base-200">
          <div className="tooltip" data-tip="clear">
            <button
              className="btn btn-sm btn-circle"
              onClick={handleClearRequests}
            >
              <Ban className="size-5" />
            </button>
          </div>
          <div
            className="tooltip"
            data-tip={newestFirst ? "newest first" : "oldest first"}
          >
            <button
              className="btn btn-sm btn-circle"
              onClick={handleToggleSort}
            >
              {newestFirst ? (
                <ClockArrowUp className="size-5" />
              ) : (
                <ClockArrowDown className="size-5" />
              )}
            </button>
          </div>
        </footer>
      </aside>
      <div className="overflow-auto">
        {selectedRequest && <JSONView data={selectedRequest.payload} />}
      </div>
      <div className="overflow-auto">
        {selectedRequest && <JSONView data={selectedRequest.response} />}
      </div>
    </main>
  )
}
