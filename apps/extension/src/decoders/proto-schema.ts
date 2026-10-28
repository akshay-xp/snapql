import { hex, keyText } from "./bytes"
import type { Field, ProtoFile, Schema } from "./proto-types"
import {
  eachField,
  float32,
  int,
  type ProtoMessage,
  Reader,
  readMessage,
  schemaLess,
} from "./protobuf"

const SCALARS = new Set([
  "double",
  "float",
  "int32",
  "int64",
  "uint32",
  "uint64",
  "sint32",
  "sint64",
  "fixed32",
  "fixed64",
  "sfixed32",
  "sfixed64",
  "bool",
  "string",
  "bytes",
])

type Token = { text: string; line: number }

const TOKEN =
  /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\.?[A-Za-z_][\w.]*|-?\d[\w.+-]*|\S/g

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let line = 1
  for (const [match] of text.matchAll(TOKEN)) {
    if (!/^(\s|\/\/|\/\*)/.test(match)) tokens.push({ text: match, line })
    line += match.split("\n").length - 1
  }
  return tokens
}

// A field type as written, resolved once every file's names are known.
type Pending = {
  type: string
  scope: string
  set: (type: string) => void
  file: string
  line: number
}

export class ProtoSchemaError extends Error {
  constructor(file: string, line: number, reason: string) {
    super(`${file}:${line}: ${reason}`)
  }
}

type Import = { path: string; file: string; line: number }

const SKIPPED = new Set(["option", "reserved", "extensions"])

export function parseProto(files: ProtoFile[]): Schema {
  const schema: Schema = { messages: {}, enums: {}, methods: {} }
  const pending: Pending[] = []
  const imports: Import[] = []
  for (const file of files)
    new FileParser(file, schema, pending, imports).parse()
  for (const i of imports) {
    const loaded = files.some(
      (f) => i.path === f.name || i.path.endsWith(`/${f.name}`),
    )
    if (!loaded && !i.path.startsWith("google/protobuf/"))
      throw new ProtoSchemaError(
        i.file,
        i.line,
        `import "${i.path}" not loaded`,
      )
  }
  for (const p of pending) {
    const type = resolve(p.type, p.scope, schema)
    if (type === undefined)
      throw new ProtoSchemaError(p.file, p.line, `unknown type ${p.type}`)
    p.set(type)
  }
  return schema
}

// Innermost scope first, walking out to the root; a leading dot is absolute.
// Well-known types resolve by name and decode schema-less.
function resolve(type: string, scope: string, schema: Schema) {
  if (SCALARS.has(type) || type.startsWith("google.protobuf.")) return type
  const known = (full: string) =>
    full in schema.messages || full in schema.enums
  if (type.startsWith("."))
    return known(type.slice(1)) ? type.slice(1) : undefined
  for (let s = scope; ; s = s.slice(0, Math.max(0, s.lastIndexOf(".")))) {
    if (known(join(s, type))) return join(s, type)
    if (!s) return
  }
}

class FileParser {
  private tokens: Token[]
  private pos = 0
  private pkg = ""
  private file: string

  constructor(
    file: ProtoFile,
    private schema: Schema,
    private pending: Pending[],
    private imports: Import[],
  ) {
    this.file = file.name
    this.tokens = tokenize(file.text)
  }

  parse() {
    while (this.pos < this.tokens.length) {
      const word = this.next()
      if (word === "syntax" || word === "option") this.skipStatement()
      else if (word === "import") {
        const line = this.line()
        let path = this.next()
        if (path === "public" || path === "weak") path = this.next()
        this.imports.push({ path: path.slice(1, -1), file: this.file, line })
        this.expect(";")
      } else if (word === "package") {
        this.pkg = this.next()
        this.expect(";")
      } else if (word === "message") this.message(this.pkg)
      else if (word === "enum") this.enumBody(this.pkg)
      else if (word === "service") this.service()
      else this.fail(`unexpected "${word}"`)
    }
  }

  private service() {
    const service = join(this.pkg, this.name())
    this.expect("{")
    while (this.peek() !== "}") {
      if (this.next() !== "rpc") {
        this.skipStatement()
        continue
      }
      const name = this.name()
      const input = this.rpcType()
      this.expect("returns")
      const method = { input, output: this.rpcType() }
      this.schema.methods[`/${service}/${name}`] = method
      const scope = this.pkg
      this.defer(input, scope, (t) => (method.input = t))
      this.defer(method.output, scope, (t) => (method.output = t))
      if (this.peek() === "{") this.skipBracketed()
      else this.expect(";")
    }
    this.next()
  }

  // ( [stream] Type )
  private rpcType() {
    this.expect("(")
    let type = this.next()
    if (type === "stream") type = this.next()
    this.expect(")")
    return type
  }

  private message(scope: string) {
    const name = join(scope, this.name())
    const fields: Record<number, Field> = {}
    this.schema.messages[name] = { fields }
    this.expect("{")
    this.body(name, fields)
  }

  private body(scope: string, fields: Record<number, Field>) {
    while (this.peek() !== "}") {
      const word = this.next()
      if (word === "message") this.message(scope)
      else if (word === "enum") this.enumBody(scope)
      else if (word === "oneof") {
        this.next()
        this.expect("{")
        this.body(scope, fields)
      } else if (SKIPPED.has(word)) this.skipStatement()
      else this.field(word, scope, fields)
    }
    this.next()
  }

  private field(word: string, scope: string, fields: Record<number, Field>) {
    const repeated = word === "repeated"
    if (repeated || word === "optional") word = this.next()
    let field: Field
    if (word === "map") {
      this.expect("<")
      const map = { key: this.next(), value: "" }
      this.expect(",")
      const value = this.next()
      this.expect(">")
      field = { name: this.name(), type: "map", map }
      this.defer(value, scope, (t) => (map.value = t))
    } else {
      field = { name: this.name(), type: word }
      if (repeated) field.repeated = true
      this.defer(word, scope, (t) => (field.type = t))
    }
    this.expect("=")
    fields[Number(this.next())] = field
    if (this.peek() === "[") this.skipBracketed()
    this.expect(";")
  }

  private enumBody(scope: string) {
    const values: Record<number, string> = {}
    this.schema.enums[join(scope, this.name())] = values
    this.expect("{")
    while (this.peek() !== "}") {
      const name = this.next()
      this.expect("=")
      values[Number(this.next())] = name
      this.expect(";")
    }
    this.next()
  }

  private skipStatement() {
    while (this.peek() !== ";") {
      if (this.peek() === "{" || this.peek() === "[") this.skipBracketed()
      else this.next()
    }
    this.next()
  }

  // Skips a balanced [...] or {...}, e.g. field options with aggregate values.
  private skipBracketed() {
    let depth = 0
    do {
      const t = this.next()
      if (t === "[" || t === "{") depth++
      if (t === "]" || t === "}") depth--
    } while (depth)
  }

  private defer(type: string, scope: string, set: (type: string) => void) {
    const line = this.tokens[this.pos - 1].line
    this.pending.push({ type, scope, set, file: this.file, line })
  }

  private line() {
    return (this.tokens[this.pos] ?? this.tokens.at(-1))?.line ?? 1
  }

  private fail(reason: string): never {
    throw new ProtoSchemaError(this.file, this.line(), reason)
  }

  // Declared names: messages, enums, fields, services, rpcs.
  private name() {
    if (!/^[A-Za-z_]\w*$/.test(this.peek() ?? "")) this.fail("expected a name")
    return this.next()
  }

  private peek() {
    return this.tokens[this.pos]?.text
  }

  private next() {
    if (this.pos >= this.tokens.length) this.fail("unexpected end of file")
    return this.tokens[this.pos++].text
  }

  private expect(text: string) {
    if (this.peek() !== text) this.fail(`expected "${text}"`)
    this.pos++
  }
}

const join = (scope: string, name: string) =>
  scope ? `${scope}.${name}` : name

// Decodes a message of the named type; unknown fields keep their numbers.
export function messageReader(
  schema: Schema,
  type: string,
): (data: Uint8Array) => unknown {
  return (data) => readTyped(schema, type, data)
}

function readTyped(schema: Schema, type: string, data: Uint8Array): unknown {
  const fields = schema.messages[type]?.fields
  return fields ? readFields(schema, fields, data) : readMessage(data)
}

function readFields(
  schema: Schema,
  fields: Record<number, Field>,
  data: Uint8Array,
): ProtoMessage {
  const message: ProtoMessage = {}
  eachField(data, (number, wireType, reader) => {
    const field = fields[number]
    if (field?.map && wireType === 2) {
      const entry = readFields(schema, entryFields(field.map), reader.bytes())
      message[field.name] = {
        ...(message[field.name] as ProtoMessage),
        [keyText(entry.key)]: entry.value,
      }
      return
    }
    const packed =
      field?.repeated && wireType === 2
        ? packedWireType(schema, field.type)
        : undefined
    const value =
      packed !== undefined
        ? readPacked(schema, field.type, packed, reader.bytes())
        : field && typedValue(schema, field.type, wireType, reader)
    if (value === undefined) message[number] = schemaLess(wireType, reader)
    else if (!field.repeated) message[field.name] = value
    else
      message[field.name] = [
        ...((message[field.name] as unknown[]) ?? []),
        ...(packed !== undefined ? (value as unknown[]) : [value]),
      ]
  })
  return message
}

const entryFields = (map: { key: string; value: string }) => ({
  1: { name: "key", type: map.key },
  2: { name: "value", type: map.value },
})

// proto3 packs repeated numeric scalars and enums.
function packedWireType(schema: Schema, type: string): number | undefined {
  if (["fixed32", "sfixed32", "float"].includes(type)) return 5
  if (["fixed64", "sfixed64", "double"].includes(type)) return 1
  if (type in schema.enums || /^(u|s)?int(32|64)$|^bool$/.test(type)) return 0
}

function readPacked(
  schema: Schema,
  type: string,
  wireType: number,
  data: Uint8Array,
): unknown[] {
  const reader = new Reader(data)
  const values: unknown[] = []
  while (!reader.done) values.push(typedValue(schema, type, wireType, reader))
  return values
}

// undefined when the wire type doesn't fit the declared type (read schema-less).
function typedValue(
  schema: Schema,
  type: string,
  wireType: number,
  reader: Reader,
): unknown {
  if (wireType === 0) return varintAs(schema, type, reader)
  if (wireType === 5) return fixed32As(type, reader)
  if (wireType === 1) return fixed64As(type, reader)
  if (wireType !== 2) return
  if (type === "string") return new TextDecoder().decode(reader.bytes())
  if (type === "bytes") return hex(reader.bytes())
  if (type in schema.messages || type.startsWith("google.protobuf."))
    return readTyped(schema, type, reader.bytes())
}

function varintAs(schema: Schema, type: string, reader: Reader): unknown {
  switch (type) {
    case "int32":
    case "int64":
      return int(BigInt.asIntN(64, reader.varint()))
    case "uint32":
    case "uint64":
      return int(reader.varint())
    case "sint32":
    case "sint64": {
      const n = reader.varint()
      return int((n >> 1n) ^ -(n & 1n))
    }
    case "bool":
      return reader.varint() !== 0n
  }
  const values = schema.enums[type]
  if (!values) return
  const n = Number(BigInt.asIntN(32, reader.varint()))
  return values[n] ?? n
}

function fixed32As(type: string, reader: Reader): unknown {
  if (type === "fixed32") return reader.take(4).getUint32(0, true)
  if (type === "sfixed32") return reader.take(4).getInt32(0, true)
  if (type === "float") return float32(reader.take(4))
}

function fixed64As(type: string, reader: Reader): unknown {
  if (type === "fixed64") return int(reader.take(8).getBigUint64(0, true))
  if (type === "sfixed64") return int(reader.take(8).getBigInt64(0, true))
  if (type === "double") return reader.take(8).getFloat64(0, true)
}
