import { useEffect, useState, type ChangeEvent } from "react"
import { JSONView } from "./components/json-view/json-view"
import { Ban, ClockArrowDown, ClockArrowUp, Search } from "lucide-react"
import { Panel, PanelGroup } from "react-resizable-panels"
import { ResizableHandle } from "./components/resizable/resizable"

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
  const [searchPattern, setSearchPattern] = useState<string>("")

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

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    // TODO: debounce
    setSearchPattern(event.target.value)
  }

  return (
    <main className="h-dvh bg-base-300">
      <PanelGroup direction="horizontal">
        <Panel defaultSize={20} minSize={20}>
          <div className="h-full overflow-auto flex flex-col relative bg-base-200">
            <header className="sticky top-0 w-full border-b border-base-100 p-2 bg-base-200">
              <label className="input input-sm">
                <Search className="size-5" />
                <input
                  type="search"
                  className="grow"
                  placeholder="Search"
                  onChange={handleSearch}
                />
              </label>
            </header>
            <ul className="flex-1">
              {parsedRequests
                .filter((request) =>
                  request.payload.operationName
                    .toLowerCase()
                    .includes(searchPattern.trim().toLocaleLowerCase())
                )
                .sort(
                  (a, b) =>
                    (newestFirst ? -1 : 1) *
                    (a.startDateTime.getTime() - b.startDateTime.getTime())
                )
                .map((request) => (
                  <li
                    key={request.id}
                    onClick={() => handleSelectRequest(request)}
                  >
                    <button className="btn btn-sm btn-block btn-ghost justify-start">
                      {request.payload.operationName}
                    </button>
                  </li>
                ))}
            </ul>
            <footer className="sticky bottom-0 w-full border-t border-base-100 p-2 bg-base-200 flex gap-1">
              <div className="tooltip" data-tip="clear">
                <button
                  className="btn btn-xs btn-circle btn-ghost"
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
                  className="btn btn-xs btn-circle btn-ghost"
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
          </div>
        </Panel>
        <ResizableHandle />
        <Panel minSize={20}>
          <div className="h-full overflow-auto">
            {selectedRequest && <JSONView data={selectedRequest.payload} />}
          </div>
        </Panel>
        <ResizableHandle />
        <Panel minSize={20}>
          <div className="h-full overflow-auto">
            {selectedRequest && <JSONView data={selectedRequest.response} />}
          </div>
        </Panel>
      </PanelGroup>
    </main>
  )
}
