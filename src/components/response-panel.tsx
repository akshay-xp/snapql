import type { ParsedRequest } from "../features/network/types"
import { JSONView } from "./json-view/json-view"

type Props = {
  selectedRequest: ParsedRequest | null
}

export function ResponsePanel({ selectedRequest }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-12 flex items-end w-full p-2 border-b border-base-100 bg-base-300">
        <h2 className="text-base">Response</h2>
      </div>
      <div className="flex-1 overflow-auto">
        {selectedRequest && <JSONView data={selectedRequest.response} />}
      </div>
    </div>
  )
}
