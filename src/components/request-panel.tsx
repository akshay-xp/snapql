import { Copy } from "lucide-react"
import type { ParsedRequest } from "../features/network/types"
import { JSONView } from "./json-view/json-view"
import { copyToClipboard } from "../util/copy-to-clipboar"
import { useState } from "react"
import { PanelTabs } from "./panel-tabs"
import { HeadersTable } from "./headers-table"

type Props = {
  selectedRequest: ParsedRequest
}

export function RequestPanel({ selectedRequest }: Props) {
  const [showHeaders, setShowHeaders] = useState(false)

  function handleCopy() {
    copyToClipboard(JSON.stringify(selectedRequest.request.payload, null, 2))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 flex items-center gap-2 w-full px-3 py-2 border-b border-base-300 bg-base-100">
        <h1 className="text-sm font-semibold truncate mr-auto">
          {selectedRequest.request.url}
        </h1>
        <PanelTabs
          title="Request"
          showHeaders={showHeaders}
          setShowHeaders={setShowHeaders}
        />
        <button className="btn btn-xs btn-circle btn-ghost">
          <Copy className="size-5" onClick={handleCopy} />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-3 py-2">
        <div className="card card-border bg-base-100">
          <div className="card-body">
            {!showHeaders ? (
              <JSONView data={selectedRequest.request.payload} />
            ) : (
              <HeadersTable headers={selectedRequest.request.headers} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
