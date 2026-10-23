import type { Field, ProtoFile, Schema } from "./proto-types"

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
type Pending = { field: Field; scope: string }

export function parseProto(files: ProtoFile[]): Schema {
  const schema: Schema = { messages: {}, enums: {}, methods: {} }
  const pending: Pending[] = []
  for (const file of files) new FileParser(file, schema, pending).parse()
  for (const { field, scope } of pending)
    field.type = resolve(field.type, scope, schema)
  return schema
}

// Innermost scope first, walking out to the root.
function resolve(type: string, scope: string, schema: Schema): string {
  if (SCALARS.has(type)) return type
  for (let s = scope; ; s = s.slice(0, Math.max(0, s.lastIndexOf(".")))) {
    const full = s ? `${s}.${type}` : type
    if (full in schema.messages || full in schema.enums) return full
    if (!s) return type
  }
}

class FileParser {
  private tokens: Token[]
  private pos = 0
  private pkg = ""

  constructor(
    file: ProtoFile,
    private schema: Schema,
    private pending: Pending[],
  ) {
    this.tokens = tokenize(file.text)
  }

  parse() {
    while (this.pos < this.tokens.length) {
      const word = this.next()
      if (word === "syntax") this.skipStatement()
      else if (word === "package") {
        this.pkg = this.next()
        this.expect(";")
      } else if (word === "message") this.message(this.pkg)
      else if (word === "enum") this.enumBody(this.pkg)
    }
  }

  private message(scope: string) {
    const name = join(scope, this.next())
    const fields: Record<number, Field> = {}
    this.schema.messages[name] = { fields }
    this.expect("{")
    while (this.peek() !== "}") {
      const word = this.next()
      if (word === "message") this.message(name)
      else if (word === "enum") this.enumBody(name)
      else {
        const field: Field = { name: this.next(), type: word }
        this.expect("=")
        fields[Number(this.next())] = field
        this.expect(";")
        this.pending.push({ field, scope: name })
      }
    }
    this.next()
  }

  private enumBody(scope: string) {
    const values: Record<number, string> = {}
    this.schema.enums[join(scope, this.next())] = values
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
    while (this.next() !== ";");
  }

  private peek() {
    return this.tokens[this.pos]?.text
  }

  private next() {
    return this.tokens[this.pos++]?.text
  }

  private expect(text: string) {
    if (this.next() !== text) throw new Error(`expected "${text}"`)
  }
}

const join = (scope: string, name: string) =>
  scope ? `${scope}.${name}` : name
