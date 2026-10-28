import { For, type JSX, Show } from "solid-js"
import type { NameValue } from "../capture/entry"
import { pairsText, valueText } from "./copy"
import { CopyButton } from "./copy-button"
import { JsonTree } from "./json-tree"
import { Marked } from "./search"
import { dataSections } from "./summary"
import { decodeValue } from "./values"

export function Text(props: { children: string; query?: string }) {
  return (
    <pre class="font-mono whitespace-pre-wrap [overflow-wrap:anywhere]">
      <Marked text={props.children} query={props.query ?? ""} />
    </pre>
  )
}

export function Section(props: {
  title: string
  copy?: () => string
  children: JSX.Element
}) {
  return (
    <section class="flex flex-col gap-1.5">
      <div class="flex h-6 items-center justify-between">
        <h2 class="font-semibold text-muted">{props.title}</h2>
        <Show when={props.copy}>
          {(copy) => (
            <CopyButton label={`Copy ${props.title}`} value={copy()} />
          )}
        </Show>
      </div>
      <div data-block class="rounded-md bg-surface px-3 py-2">
        {props.children}
      </div>
    </section>
  )
}

export function Pairs(props: {
  title: string
  pairs: NameValue[]
  decode?: boolean
}) {
  return (
    <Section title={props.title} copy={() => pairsText(props.pairs)}>
      <Show when={props.pairs.length} fallback={<p class="text-muted">None</p>}>
        <dl
          data-section={props.title}
          class="grid grid-cols-[fit-content(40%)_minmax(0,1fr)] gap-x-4 gap-y-0.5 font-mono"
        >
          <For each={props.pairs}>
            {(pair) => (
              <>
                <dt class="text-syntax-key [overflow-wrap:anywhere]">
                  {pair.name}
                </dt>
                <dd class="[overflow-wrap:anywhere]">
                  <span
                    data-value
                    classList={{ "text-error": props.title === "errors" }}
                  >
                    {pair.value}
                  </span>
                  <Show when={props.decode && decodeValue(pair.value)}>
                    {(decoded) => (
                      <div class="whitespace-pre-wrap text-muted">
                        {decoded()}
                      </div>
                    )}
                  </Show>
                </dd>
              </>
            )}
          </For>
        </dl>
      </Show>
    </Section>
  )
}

export function Sections(props: { data: unknown }) {
  return (
    <For each={dataSections(props.data)}>
      {(section) =>
        "rows" in section ? (
          <Pairs title={section.name} pairs={section.rows} />
        ) : (
          <Section
            title={section.name}
            copy={() =>
              valueText("text" in section ? section.text : section.json)
            }
          >
            {"text" in section ? (
              <Text>{section.text}</Text>
            ) : (
              <JsonTree value={section.json} />
            )}
          </Section>
        )
      }
    </For>
  )
}
