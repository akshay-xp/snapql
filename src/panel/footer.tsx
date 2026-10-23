import { createSignal, Show } from "solid-js"
import { count } from "../decoders/text"
import { IconButton } from "./icon-button"
import { SchemaPicker } from "./schema-picker"
import type { Schemas } from "./schemas"

export function Footer(props: {
  count: number
  total?: number
  onClear: () => void
  newestFirst: boolean
  onSort: () => void
  preserveLog: boolean
  onPreserveLog: (on: boolean) => void
  onReloadCapture: () => void
  schemas: Schemas
  exportCount: number
  onExportHar: () => Promise<void>
}) {
  const [picking, setPicking] = createSignal(false)
  const [exporting, setExporting] = createSignal(false)
  return (
    <footer class="relative flex h-8 shrink-0 items-center gap-0.5 border-t border-border px-1.5">
      <IconButton label="Clear" onClick={props.onClear}>
        <circle cx="12" cy="12" r="9" />
        <path d="m5.6 5.6 12.8 12.8" />
      </IconButton>
      <IconButton
        label={props.newestFirst ? "Newest first" : "Oldest first"}
        onClick={props.onSort}
      >
        <path
          d={
            props.newestFirst
              ? "M7 20V4M3 8l4-4 4 4M14 6h7M14 12h5M14 18h3"
              : "M7 4v16M3 16l4 4 4-4M14 6h3M14 12h5M14 18h7"
          }
        />
      </IconButton>
      <IconButton
        label="Preserve log"
        pressed={props.preserveLog}
        onClick={() => props.onPreserveLog(!props.preserveLog)}
      >
        <path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z" />
      </IconButton>
      <IconButton label="Reload and capture" onClick={props.onReloadCapture}>
        <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
      </IconButton>
      <IconButton
        label="Schemas"
        pressed={picking()}
        onClick={() => setPicking(!picking())}
      >
        <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1" />
      </IconButton>
      <IconButton
        label="Export HAR"
        pressed={exporting()}
        onClick={() => setExporting(!exporting())}
      >
        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
      </IconButton>
      <Show when={picking()}>
        <SchemaPicker schemas={props.schemas} />
      </Show>
      <Show when={exporting()}>
        <div
          data-export
          class="absolute bottom-full left-1.5 z-10 mb-1 flex w-56 items-center justify-between gap-2 rounded-md border border-border bg-bg p-2 shadow-lg"
        >
          <span>Export {count(props.exportCount, "request")}</span>
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-accent hover:bg-selected disabled:text-muted"
            disabled={!props.exportCount}
            onClick={async () => {
              await props.onExportHar()
              setExporting(false)
            }}
          >
            Download
          </button>
        </div>
      </Show>
      <span class="ml-auto pr-1 text-muted">
        {props.total === undefined
          ? count(props.count, "request")
          : `${props.count} of ${props.total}`}
      </span>
    </footer>
  )
}
