import { Ban, ClockArrowDown, ClockArrowUp, Search } from "lucide-react"
import type { ParsedRequest } from "../features/network/types"
import { type ChangeEvent } from "react"
import { useSearch } from "../features/search/use-search"

type Props = {
  parsedRequests: ParsedRequest[]
  resetParsedRequests: () => void
  selectedRequest: ParsedRequest | null
  setSelectedRequest: (req: ParsedRequest | null) => void
}

export function NetworkSidebar({
  parsedRequests,
  resetParsedRequests,
  // selectedRequest,
  setSelectedRequest,
}: Props) {
  const { results, setSearchPattern, newestFirst, setNewestFirst } = useSearch({
    parsedRequests,
  })

  const handleClearRequests = () => {
    resetParsedRequests()
    setSelectedRequest(null)
  }

  const handleToggleSort = () => {
    setNewestFirst((prev) => !prev)
  }

  const handleSelectRequest = (selectedRequest: ParsedRequest) => {
    setSelectedRequest(selectedRequest)
  }

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchPattern(event.target.value)
  }

  return (
    <div className="h-full overflow-auto flex flex-col relative bg-base-100">
      <header className="h-12 sticky top-0 w-full border-b border-base-300 p-2 bg-base-100 z-10">
        <label className="input input-sm w-full">
          <Search className="size-5" />
          <input
            type="search"
            className="grow"
            placeholder="Search"
            onChange={handleSearch}
          />
        </label>
      </header>
      <ul className="menu w-full flex-1">
        {results.map((request) => (
          <li
            // TODO: find a better key
            key={`${
              request.payload.operationName
            }-${request.startDateTime.toISOString()}`}
          >
            <button onClick={() => handleSelectRequest(request)}>
              {request.response?.errors ? (
                <div
                  aria-label="request failed"
                  className="status status-error"
                ></div>
              ) : (
                <div
                  aria-label="request succeeded"
                  className="status status-success"
                ></div>
              )}
              <div className="truncate">{request.payload.operationName}</div>
            </button>
          </li>
        ))}
      </ul>
      <footer className="sticky bottom-0 w-full border-t border-base-300 p-2 bg-base-100 flex gap-1 z-10">
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
  )
}
