import { createSignal, For, onCleanup } from "solid-js"
import type { Store } from "../capture/store"

export function App(props: { store: Store }) {
  const [entries, setEntries] = createSignal(props.store.snapshot())
  onCleanup(props.store.subscribe(() => setEntries(props.store.snapshot())))

  return (
    <main class="flex h-dvh flex-col font-mono text-xs">
      <header class="flex items-center gap-2 border-b border-gray-300 p-2">
        <h1 class="font-semibold">SnapQL</h1>
        <button
          type="button"
          class="ml-auto rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100"
          onClick={() => props.store.clear()}
        >
          Clear
        </button>
      </header>
      <ul class="flex-1 overflow-y-auto">
        <For each={entries()}>
          {(entry) => (
            <li class="flex gap-2 border-b border-gray-100 px-2 py-1">
              <span class="w-14 shrink-0">{entry.method}</span>
              <span class="w-10 shrink-0">{entry.status}</span>
              <span class="truncate" title={entry.url}>
                {entry.url}
              </span>
            </li>
          )}
        </For>
      </ul>
    </main>
  )
}
