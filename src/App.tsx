import { useState } from "react"
import { Panel, PanelGroup } from "react-resizable-panels"
import { ResizableHandle } from "./components/resizable/resizable"
import type { ParsedRequest } from "./features/network/types"
import { useNetwork } from "./features/network/use-network"
import { NetworkSidebar } from "./components/network-sidebar"
import { RequestPanel } from "./components/request-panel"
import { ResponsePanel } from "./components/response-panel"
import { useBreakpoint } from "./util/use-breakpoint"

export function App() {
  const { parsedRequests, resetParsedRequests } = useNetwork()
  const [selectedRequest, setSelectedRequest] = useState<ParsedRequest | null>(
    null
  )
  const breakpoint = useBreakpoint()
  const direction =
    breakpoint === "base" || breakpoint === "sm" ? "vertical" : "horizontal"

  return (
    <main className="h-dvh bg-base-200">
      <PanelGroup direction="horizontal">
        <Panel minSize={10} defaultSize={20}>
          <NetworkSidebar
            parsedRequests={parsedRequests}
            selectedRequest={selectedRequest}
            setSelectedRequest={setSelectedRequest}
            resetParsedRequests={resetParsedRequests}
          />
        </Panel>
        <ResizableHandle />
        {selectedRequest ? (
          <Panel>
            <PanelGroup direction={direction}>
              <Panel minSize={25} collapsible>
                <RequestPanel selectedRequest={selectedRequest} />
              </Panel>
              <ResizableHandle />
              <Panel minSize={25} collapsible>
                <ResponsePanel selectedRequest={selectedRequest} />
              </Panel>
            </PanelGroup>
          </Panel>
        ) : (
          <Panel></Panel>
        )}
      </PanelGroup>
    </main>
  )
}
