import { createEffect, createSignal, on, Show } from "solid-js"
import type { Message } from "../capture/entry"
import { treeValue } from "./json"
import { JsonTree } from "./json-tree"
import { byteLabel, messageBytes, offsetLabel, preview } from "./messages"
import { Section, Text } from "./section"
import { VirtualListbox } from "./virtual-listbox"

export function Messages(props: {
  messages: readonly Message[]
  // Body-parsed messages share the request's start time, so offsets mean nothing.
  timed: boolean
}) {
  const indexes = () => props.messages.map((_, i) => i)
  const [selected, setSelected] = createSignal<number>()
  createEffect(
    on(
      () => props.messages,
      () => setSelected(undefined),
    ),
  )
  const message = () => {
    const i = selected()
    return i === undefined ? undefined : props.messages[i]
  }
  return (
    <>
      <div class="flex min-h-24 flex-1 flex-col rounded border border-border">
        <VirtualListbox
          items={indexes()}
          key={(i) => i}
          selected={selected()}
          onSelect={setSelected}
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
      {/* Keyed: a fresh Section per message, so a "Copied" state never carries over. */}
      <Show when={message()} keyed>
        {(m) => (
          <div class="max-h-1/2 shrink-0 overflow-auto">
            <Section
              title={`Message ${(selected() ?? 0) + 1}`}
              copy={() => m.text}
            >
              <Show when={treeValue(m.text)} fallback={<Text>{m.text}</Text>}>
                {(value) => <JsonTree value={value()} />}
              </Show>
            </Section>
          </div>
        )}
      </Show>
    </>
  )
}
