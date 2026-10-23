import { For, Show } from "solid-js"
import { IconButton } from "./icon-button"
import type { Schemas } from "./schemas"

export function SchemaPicker(props: { schemas: Schemas }) {
  let input!: HTMLInputElement
  const pick = async () => {
    const files = [...(input.files ?? [])]
    input.value = ""
    await props.schemas.add(
      await Promise.all(
        files.map(async (f) => ({ name: f.name, text: await f.text() })),
      ),
    )
  }
  return (
    <div
      data-schemas
      class="absolute bottom-full left-1.5 z-10 mb-1 flex w-72 flex-col gap-2 rounded-md border border-border bg-bg p-2 shadow-lg"
    >
      <div class="flex items-center justify-between">
        <span class="font-semibold">Schemas</span>
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-accent hover:bg-selected"
          onClick={() => input.click()}
        >
          Add .proto files
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".proto"
          class="hidden"
          onChange={pick}
        />
      </div>
      <Show
        when={props.schemas.files().length}
        fallback={<p class="text-muted">No .proto files loaded</p>}
      >
        <ul class="flex flex-col font-mono">
          <For each={props.schemas.files()}>
            {(name) => (
              <li class="flex items-center justify-between gap-2">
                <span class="truncate">{name}</span>
                <IconButton
                  label={`Remove ${name}`}
                  onClick={() => props.schemas.remove(name)}
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </IconButton>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.schemas.error()}>
        {(error) => (
          <p class="font-mono text-error [overflow-wrap:anywhere]">{error()}</p>
        )}
      </Show>
    </div>
  )
}
