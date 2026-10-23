import { createSignal, Show } from "solid-js"
import type { Message } from "../capture/entry"
import type { Decoded } from "../decoders/types"
import { treeValue } from "./json"
import { JsonTree } from "./json-tree"
import {
  arrow,
  byteLabel,
  frameLabel,
  messageBytes,
  messageText,
  offsetLabel,
} from "./messages"
import { Section, Text } from "./section"
import { VirtualListbox } from "./virtual-listbox"

export function Messages(props: {
  messages: readonly Message[]
  // Body-parsed messages share the request's start time, so offsets mean nothing.
  timed: boolean
  // Sockets go both ways; streams only arrive, so arrows would be noise.
  directions?: boolean
  // A socket protocol's frame decoder, run only for rendered rows.
  decode?: (m: Message) => Decoded | undefined
}) {
  const indexes = () => props.messages.map((_, i) => i)
  const [selected, setSelected] = createSignal<number>()
  // Decoded frames show their data rather than the raw text.
  const decodedTree = (m: Message) => {
    const data = props.decode?.(m)?.data
    return typeof data === "object" && data !== null ? data : undefined
  }
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
          follow
        >
          {(i, selected) => {
            const m = props.messages[i]
            const label = frameLabel(m, props.decode?.(m))
            // Muted and syntax colors fall under 4.5:1 on the selected row.
            const muted = () => ({ "text-muted": !selected() })
            return (
              <>
                <Show when={props.timed}>
                  <span class="shrink-0" classList={muted()}>
                    {offsetLabel(m.time - props.messages[0].time)}
                  </span>
                </Show>
                <Show when={props.directions}>
                  <span class="shrink-0" classList={muted()}>
                    {arrow(m.dir)}
                  </span>
                </Show>
                <Show when={m.event}>
                  <span
                    class="shrink-0"
                    classList={{ "text-syntax-key": !selected() }}
                  >
                    {m.event}
                  </span>
                </Show>
                <span class="min-w-0 flex-1 truncate">
                  {label.text}
                  <Show when={label.detail}>
                    <span classList={muted()}> {label.detail}</span>
                  </Show>
                </span>
                <span class="shrink-0" classList={muted()}>
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
              <Show
                when={decodedTree(m) ?? treeValue(m.text)}
                fallback={
                  <Text>{m.bytes === undefined ? m.text : messageText(m)}</Text>
                }
              >
                {(value) => <JsonTree value={value()} />}
              </Show>
            </Section>
          </div>
        )}
      </Show>
    </>
  )
}
