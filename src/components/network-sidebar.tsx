import { Ban, ClockArrowDown, ClockArrowUp, Search } from "lucide-react"
import type { ParsedRequest } from "../features/network/types"
import { useState, type ChangeEvent } from "react"

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
  const [searchPattern, setSearchPattern] = useState<string>("")
  const [newestFirst, setNewestFirst] = useState<boolean>(true)

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
    // TODO: debounce
    setSearchPattern(event.target.value)
  }

  return (
    <div className="h-full overflow-auto flex flex-col relative bg-base-100">
      <header className="h-12 sticky top-0 w-full border-b border-base-300 p-2 bg-base-100 z-10">
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
      <ul className="menu w-full flex-1">
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
            // todo: use a better key
            <li key={request.id}>
              <button onClick={() => handleSelectRequest(request)}>
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
