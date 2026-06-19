import { useState } from "react"
import { Panel, PanelGroup } from "react-resizable-panels"
import { ResizableHandle } from "./components/resizable/resizable"
import type { ParsedRequest } from "./features/network/types"
import { useNetwork } from "./features/network/use-network"
import { NetworkSidebar } from "./components/network-sidebar"
import { DetailPanel } from "./components/detail-panel"
import { useBreakpoint } from "./util/use-breakpoint"

export function App() {
  const { parsedRequests, resetParsedRequests } = useNetwork()
  const [selectedRequest, setSelectedRequest] = useState<ParsedRequest | null>(
    null
  )
  const breakpoint = useBreakpoint()
  const direction =
    breakpoint === "base" || breakpoint === "sm" ? "vertical" : "horizontal"

  const fromCacheTag =
    selectedRequest?.fromCache ??
    (selectedRequest?.response._fetchedViaServiceWorker && "service worker")
  const responseTitle = selectedRequest
    ? [
        selectedRequest.response.status &&
          `${selectedRequest.response.status} ${selectedRequest.response.statusText}`,
        `${selectedRequest.time} ms`,
        fromCacheTag && `from ${fromCacheTag}`,
      ]
        .filter(Boolean)
        .join(" • ")
    : ""

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
                <DetailPanel
                  title={selectedRequest.request.url}
                  data={selectedRequest.request.data}
                  headers={selectedRequest.request.headers}
                />
              </Panel>
              <ResizableHandle />
              <Panel minSize={25} collapsible>
                <DetailPanel
                  title={responseTitle}
                  data={selectedRequest.response.data}
                  headers={selectedRequest.response.headers}
                  emptyState={
                    <div className="text-center">
                      <p className="font-bold">Failed to load response data</p>
                      <p className="text-sm text-base-content/70">
                        No data found for resource with given identifier
                      </p>
                    </div>
                  }
                />
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
