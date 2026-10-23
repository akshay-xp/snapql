import { createSignal } from "solid-js"
import type { ProtoFile, Schema } from "../decoders/proto-types"

const KEY = "snapql.schemas"
const EMPTY: Schema = { messages: {}, enums: {}, methods: {} }

type Stored = { files: ProtoFile[]; schema: Schema }
type KeyValueStorage = Pick<Storage, "getItem" | "setItem">

export type Schemas = ReturnType<typeof createSchemas>

// The compiled schema is stored too, so startup needs no parser.
export function createSchemas(
  storage: KeyValueStorage | undefined,
  compile: (files: ProtoFile[]) => Promise<Schema>,
) {
  const [state, setState] = createSignal<Stored>(load(storage))
  const [error, setError] = createSignal<string>()

  async function update(files: ProtoFile[]) {
    try {
      const next = { files, schema: await compile(files) }
      setState(next)
      setError()
      try {
        storage?.setItem(KEY, JSON.stringify(next))
      } catch {}
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return {
    files: () => state().files.map((f) => f.name),
    schema: () => state().schema,
    error,
    add: (added: ProtoFile[]) =>
      update([
        ...state().files.filter((f) => !added.some((a) => a.name === f.name)),
        ...added,
      ]),
    remove: (name: string) =>
      update(state().files.filter((f) => f.name !== name)),
  }
}

function load(storage: KeyValueStorage | undefined): Stored {
  try {
    const stored = storage?.getItem(KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return { files: [], schema: EMPTY }
}
