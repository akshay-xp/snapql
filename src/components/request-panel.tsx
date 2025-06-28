import type { ParsedRequest } from "../features/network/types"
import { JSONView } from "./json-view/json-view"

type Props = {
  selectedRequest: ParsedRequest | null
}

export function RequestPanel({ selectedRequest }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-12 flex items-end w-full p-2 border-b border-base-300 bg-base-100">
        <h2 className="text-lg">Request</h2>
      </div>
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="card card-border bg-base-100">
          <div className="card-body">
            {selectedRequest && <JSONView data={selectedRequest.payload} />}
          </div>
        </div>
      </div>
    </div>
  )
}
