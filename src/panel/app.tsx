import { type Accessor, createSignal, onCleanup } from "solid-js"
import type { Store } from "../capture/store"
import { List } from "./list"

export function App(props: {
  store: Store
  preserveLog: Accessor<boolean>
  setPreserveLog: (on: boolean) => void
}) {
  const [entries, setEntries] = createSignal(props.store.snapshot())
  onCleanup(props.store.subscribe(() => setEntries(props.store.snapshot())))
  const [selectedId, setSelectedId] = createSignal<number>()

  return (
    <main class="flex h-dvh flex-col font-mono text-xs">
      <header class="flex items-center gap-2 border-b border-border p-2">
        <h1 class="font-semibold">SnapQL</h1>
        <label class="ml-auto flex items-center gap-1">
          <input
            type="checkbox"
            checked={props.preserveLog()}
            onChange={(e) => props.setPreserveLog(e.currentTarget.checked)}
          />
          Preserve log
        </label>
        <button
          type="button"
          class="rounded border border-border px-2 py-0.5 hover:bg-selected"
          onClick={() => props.store.clear()}
        >
          Clear
        </button>
      </header>
      <List
        entries={entries()}
        selectedId={selectedId()}
        onSelect={setSelectedId}
      />
    </main>
  )
}
