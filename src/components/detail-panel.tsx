import { Copy } from "lucide-react"
import { JSONView } from "./json-view/json-view"
import { copyToClipboard } from "../util/copy-to-clipboar"
import { useState, type ReactNode } from "react"
import { PanelTabs } from "./panel-tabs"
import { HeadersTable } from "./headers-table"

type Props = {
  title: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: object | any[] | null
  headers: chrome.devtools.network.Request["request"]["headers"]
  emptyState?: ReactNode
}

export function DetailPanel({ title, data, headers, emptyState }: Props) {
  const [showHeaders, setShowHeaders] = useState(false)

  function handleCopy() {
    copyToClipboard(JSON.stringify(data, null, 2))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 flex items-center gap-2 w-full px-3 py-2 border-b border-base-300 bg-base-100">
        <p className="text-sm font-semibold truncate mr-auto">{title}</p>
        <PanelTabs
          bodyLabel="Body"
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
              data ? (
                <JSONView data={data} />
              ) : (
                emptyState ?? null
              )
            ) : (
              <HeadersTable headers={headers} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
