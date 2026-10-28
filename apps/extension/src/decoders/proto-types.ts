// Compiled .proto schema, stored as JSON. Full names have no leading dot.
export type Field = {
  name: string
  type: string
  repeated?: true
  map?: { key: string; value: string }
}

export type Schema = {
  messages: Record<string, { fields: Record<number, Field> }>
  enums: Record<string, Record<number, string>>
  methods: Record<string, { input: string; output: string }>
}

export type ProtoFile = { name: string; text: string }
