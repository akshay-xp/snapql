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
    <main className="h-dvh bg-base-200">
      <PanelGroup direction="horizontal">
        <Panel defaultSize={20} minSize={20}>
          <NetworkSidebar
            parsedRequests={parsedRequests}
            selectedRequest={selectedRequest}
            setSelectedRequest={setSelectedRequest}
            resetParsedRequests={resetParsedRequests}
          />
        </Panel>
        <ResizableHandle />
        {selectedRequest ? (
          <>
            <Panel>
              <RequestPanel selectedRequest={selectedRequest} />
            </Panel>
            <ResizableHandle />
            <Panel>
              <ResponsePanel selectedRequest={selectedRequest} />
            </Panel>
          </>
        ) : (
          <Panel></Panel>
        )}
      </PanelGroup>
    </main>
  )
}
