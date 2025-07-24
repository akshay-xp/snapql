import { Copy } from "lucide-react"
import type { ParsedRequest } from "../features/network/types"
import { JSONView } from "./json-view/json-view"
import { copyToClipboard } from "../util/copy-to-clipboar"

type Props = {
  selectedRequest: ParsedRequest | null
}

export function RequestPanel({ selectedRequest }: Props) {
  function handleCopy() {
    copyToClipboard(JSON.stringify(selectedRequest?.payload, null, 2))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 flex items-end w-full px-3 py-2 border-b border-base-300 bg-base-100">
        <h2 className="text-lg">Request</h2>
        <button className="btn btn-xs btn-circle btn-ghost ml-auto">
          <Copy className="size-5" onClick={handleCopy} />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-3 py-2">
        <div className="card card-border bg-base-100">
          <div className="card-body">
            {selectedRequest && <JSONView data={selectedRequest.payload} />}
          </div>
        </div>
      </div>
    </div>
  )
}
