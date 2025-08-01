import {
  Ban,
  ClockArrowDown,
  ClockArrowUp,
  Funnel,
  Search,
  X,
} from "lucide-react"
import type { ParsedRequest } from "../features/network/types"
import { useRef, useState, type ChangeEvent } from "react"
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
  selectedRequest,
  setSelectedRequest,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [showCachedResponses, setShowCachedResponses] = useState(true)

  const { results, setSearchPattern, newestFirst, setNewestFirst } = useSearch({
    parsedRequests,
    showCachedResponses,
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

  const handleShowCacheToggle = () => {
    setShowCachedResponses((prev) => !prev)
  }

  const handleModalOpen = () => {
    dialogRef.current?.showModal()
  }

  return (
    <div className="h-full flex flex-col relative bg-base-100">
      <header className="h-12 w-full border-b border-base-300 px-3 py-2 bg-base-100 z-10">
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
      <ul className="menu flex-nowrap w-full flex-1 overflow-y-auto">
        {results.map((result) => (
          <li
            // TODO: find a better key
            key={`${
              result.request.payload.operationName
            }-${result.startDateTime.toISOString()}-${result.time}`}
          >
            <button
              onClick={() => handleSelectRequest(result)}
              className={
                `${
                  result.request.payload.operationName
                }-${result.startDateTime.toISOString()}` ===
                `${
                  selectedRequest?.request.payload.operationName
                }-${selectedRequest?.startDateTime.toISOString()}`
                  ? "menu-active [--menu-active-fg:text-base-content]"
                  : "text-base-content/70 hover:text-base-content"
              }
            >
              {result.response.data?.errors ? (
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
              <div className="truncate">
                {result.request.payload.operationName}
              </div>
            </button>
          </li>
        ))}
      </ul>
      <footer className="h-12 w-full border-t border-base-300 px-3 py-2 bg-base-100 flex items-center gap-1 z-10">
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
        <div className="tooltip" data-tip={"filter"}>
          <button
            className="btn btn-xs btn-circle btn-ghost"
            onClick={handleModalOpen}
          >
            <Funnel className="size-5" />
          </button>
          <dialog ref={dialogRef} className="modal">
            <div className="modal-box">
              <h3 className="font-bold text-lg">Filter Requests</h3>
              <form method="dialog">
                {/* if there is a button in form, it will close the modal */}
                <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
                  <X className="size-5" />
                </button>
              </form>
              <label className="label py-4 text-sm">
                <input
                  type="checkbox"
                  checked={showCachedResponses}
                  onChange={handleShowCacheToggle}
                  className="toggle toggle-sm toggle-secondary"
                />
                Show cached requests
              </label>
            </div>
            <form method="dialog" className="modal-backdrop">
              <button>close</button>
            </form>
          </dialog>
        </div>
      </footer>
    </div>
  )
}
