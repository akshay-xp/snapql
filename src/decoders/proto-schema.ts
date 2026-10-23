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
type Pending = { type: string; scope: string; set: (type: string) => void }

const SKIPPED = new Set(["option", "reserved", "extensions"])

export function parseProto(files: ProtoFile[]): Schema {
  const schema: Schema = { messages: {}, enums: {}, methods: {} }
  const pending: Pending[] = []
  for (const file of files) new FileParser(file, schema, pending).parse()
  for (const p of pending) p.set(resolve(p.type, p.scope, schema))
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
      else if (word === "service") this.service()
    }
  }

  private service() {
    const service = join(this.pkg, this.next())
    this.expect("{")
    while (this.peek() !== "}") {
      if (this.next() !== "rpc") {
        this.skipStatement()
        continue
      }
      const name = this.next()
      const input = this.rpcType()
      this.expect("returns")
      const method = { input, output: this.rpcType() }
      this.schema.methods[`/${service}/${name}`] = method
      const scope = this.pkg
      this.pending.push({ type: input, scope, set: (t) => (method.input = t) })
      this.pending.push({
        type: method.output,
        scope,
        set: (t) => (method.output = t),
      })
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
    const name = join(scope, this.next())
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
      field = { name: this.next(), type: "map", map }
      this.pending.push({ type: value, scope, set: (t) => (map.value = t) })
    } else {
      field = { name: this.next(), type: word }
      if (repeated) field.repeated = true
      this.pending.push({ type: word, scope, set: (t) => (field.type = t) })
    }
    this.expect("=")
    fields[Number(this.next())] = field
    if (this.peek() === "[") this.skipBracketed()
    this.expect(";")
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
