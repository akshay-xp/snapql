import { Show } from "solid-js"
import type { Message } from "../capture/entry"
import { byteLabel, messageBytes, offsetLabel, preview } from "./messages"
import { VirtualListbox } from "./virtual-listbox"

export function Messages(props: {
  messages: readonly Message[]
  // Body-parsed messages share the request's start time, so offsets mean nothing.
  timed: boolean
}) {
  const indexes = () => props.messages.map((_, i) => i)
  return (
    <div class="flex min-h-24 flex-1 flex-col rounded border border-border">
      <VirtualListbox
        items={indexes()}
        key={(i) => i}
        selected={undefined}
        onSelect={() => {}}
        label="Messages"
        idPrefix="message-"
      >
        {(i) => {
          const m = props.messages[i]
          return (
            <>
              <Show when={props.timed}>
                <span class="shrink-0 text-muted">
                  {offsetLabel(m.time - props.messages[0].time)}
                </span>
              </Show>
              <Show when={m.event}>
                <span class="shrink-0 text-syntax-key">{m.event}</span>
              </Show>
              <span class="min-w-0 flex-1 truncate">{preview(m.text)}</span>
              <span class="shrink-0 text-muted">
                {byteLabel(messageBytes(m))}
              </span>
            </>
          )
        }}
      </VirtualListbox>
    </div>
  )
}
