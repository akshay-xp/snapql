import type { Entry } from "../capture/entry"

export function Detail(_props: { entry: Entry }) {
  return (
    <section class="flex w-1/2 flex-col border-l border-border">
      <div role="tablist" class="flex border-b border-border">
        <button
          type="button"
          role="tab"
          id="tab-summary"
          aria-selected="true"
          aria-controls="panel-summary"
          class="border-b-2 border-fg px-2 py-1"
        >
          Summary
        </button>
      </div>
      <div
        role="tabpanel"
        id="panel-summary"
        aria-labelledby="tab-summary"
        class="flex-1 overflow-auto p-2"
      />
    </section>
  )
}
