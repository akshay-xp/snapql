import { useState } from "react"
import { Panel, PanelGroup } from "react-resizable-panels"
import { ResizableHandle } from "./components/resizable/resizable"
import type { ParsedRequest } from "./features/network/types"
import { useNetwork } from "./features/network/use-network"
import { NetworkSidebar } from "./components/network-sidebar"
import { RequestPanel } from "./components/request-panel"
import { ResponsePanel } from "./components/response-panel"

export function App() {
  const { parsedRequests, resetParsedRequests } = useNetwork()
  const [selectedRequest, setSelectedRequest] = useState<ParsedRequest | null>(
    null
  )

  return (
    <main className="h-dvh bg-base-300">
      <PanelGroup direction="horizontal">
        <Panel defaultSize={20} minSize={20}>
          <NetworkSidebar
            parsedRequests={parsedRequests}
            setSelectedRequest={setSelectedRequest}
            resetParsedRequests={resetParsedRequests}
          />
        </Panel>
        <ResizableHandle />
        <Panel minSize={20}>
          <RequestPanel selectedRequest={selectedRequest} />
        </Panel>
        <ResizableHandle />
        <Panel minSize={20}>
          <ResponsePanel selectedRequest={selectedRequest} />
        </Panel>
      </PanelGroup>
    </main>
  )
}
