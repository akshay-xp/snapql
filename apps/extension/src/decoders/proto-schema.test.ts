import { describe, expect, it } from "vitest"
import { messageReader, parseProto } from "./proto-schema"

const parse = (text: string, name = "a.proto") => parseProto([{ name, text }])

describe("parseProto", () => {
  it("parses messages, nested types and enums in a package", () => {
    const schema = parse(`
      syntax = "proto3";
      // a comment
      package ex;
      /* block
         comment */
      message User {
        string name = 1;
        Role role = 2;
        message Inner { int32 n = 1; }
        Inner inner = 3;
      }
      enum Role { ROLE_UNKNOWN = 0; ADMIN = 1; }
    `)
    expect(schema.messages["ex.User"].fields).toEqual({
      1: { name: "name", type: "string" },
      2: { name: "role", type: "ex.Role" },
      3: { name: "inner", type: "ex.User.Inner" },
    })
    expect(schema.messages["ex.User.Inner"].fields).toEqual({
      1: { name: "n", type: "int32" },
    })
    expect(schema.enums["ex.Role"]).toEqual({ 0: "ROLE_UNKNOWN", 1: "ADMIN" })
    expect(schema.methods).toEqual({})
  })

  it("uses bare names without a package", () => {
    expect(Object.keys(parse("message User {}").messages)).toEqual(["User"])
  })
})

describe("parseProto fields", () => {
  const fields = parse(`
    package ex;
    message User {
      option deprecated = true;
      reserved 10, 12 to 15;
      reserved "foo";
      extensions 100 to 199;
      repeated int32 scores = 4;
      optional string nick = 5;
      map<string, User> friends = 6;
      oneof pick { string a = 7; int32 b = 8; }
      int32 old = 9 [deprecated = true, (my.opt) = { a: 1 }];
    }
  `).messages["ex.User"].fields

  it("parses repeated, optional, map and oneof fields", () => {
    expect(fields[4]).toEqual({ name: "scores", type: "int32", repeated: true })
    expect(fields[5]).toEqual({ name: "nick", type: "string" })
    expect(fields[6]).toEqual({
      name: "friends",
      type: "map",
      map: { key: "string", value: "ex.User" },
    })
    expect(fields[7]).toEqual({ name: "a", type: "string" })
    expect(fields[8]).toEqual({ name: "b", type: "int32" })
  })

  it("skips options and reserved statements", () => {
    expect(fields[9]).toEqual({ name: "old", type: "int32" })
    expect(Object.keys(fields)).toEqual(["4", "5", "6", "7", "8", "9"])
  })
})

describe("parseProto services", () => {
  it("maps method paths to input and output types", () => {
    const { methods } = parse(`
      package ex;
      message GetUserRequest {}
      message User {}
      service UserService {
        option (svc) = true;
        rpc GetUser(GetUserRequest) returns (User);
        rpc ListUsers(GetUserRequest) returns (stream User) { option (x) = 1; }
      }
    `)
    expect(methods).toEqual({
      "/ex.UserService/GetUser": {
        input: "ex.GetUserRequest",
        output: "ex.User",
      },
      "/ex.UserService/ListUsers": {
        input: "ex.GetUserRequest",
        output: "ex.User",
      },
    })
  })
})

describe("parseProto names and errors", () => {
  it("resolves names innermost scope first", () => {
    const type = (decls: string) =>
      parse(`package a.b; ${decls} message M { C f = 1; }`).messages["a.b.M"]
        .fields[1].type
    expect(type("message C {}")).toBe("a.b.C")
    const nested = parse("package a.b; message M { message C {} C f = 1; }")
    expect(nested.messages["a.b.M"].fields[1].type).toBe("a.b.M.C")
    const outer = parseProto([
      { name: "a.proto", text: "package a; message C {}" },
      { name: "b.proto", text: "package a.b; message M { C f = 1; }" },
    ])
    expect(outer.messages["a.b.M"].fields[1].type).toBe("a.C")
  })

  it("treats a leading dot as absolute", () => {
    const schema = parse(
      "package x; message Y {} message M { message Y {} .x.Y f = 1; }",
    )
    expect(schema.messages["x.M"].fields[1].type).toBe("x.Y")
  })

  it("resolves types from imported files in any order", () => {
    const schema = parseProto([
      {
        name: "b.proto",
        text: 'package ex; import "protos/a.proto"; message Box { User u = 1; }',
      },
      { name: "a.proto", text: "package ex; message User {}" },
    ])
    expect(schema.messages["ex.Box"].fields[1].type).toBe("ex.User")
  })

  it("knows well-known types by name", () => {
    const schema = parse(
      'import "google/protobuf/timestamp.proto"; message M { google.protobuf.Timestamp at = 1; }',
    )
    expect(schema.messages.M.fields[1].type).toBe("google.protobuf.Timestamp")
    expect(schema.messages).not.toHaveProperty("google.protobuf.Timestamp")
  })

  it("reports file and line", () => {
    expect(() => parse("message M {\n\n  Missing m = 1;\n}")).toThrow(
      "a.proto:3: unknown type Missing",
    )
    expect(() => parse('package ex;\nimport "z.proto";', "b.proto")).toThrow(
      'b.proto:2: import "z.proto" not loaded',
    )
    expect(() => parse("message M {\n  int32 a = 1\n}")).toThrow(
      'a.proto:3: expected ";"',
    )
    expect(() => parse("message {")).toThrow("a.proto:1:")
  })
})

const varint = (n: bigint) => {
  const out: number[] = []
  do {
    const byte = Number(n & 0x7fn)
    n >>= 7n
    out.push(n ? byte | 0x80 : byte)
  } while (n)
  return out
}
const le = (size: number, write: (v: DataView) => void) => {
  const view = new DataView(new ArrayBuffer(size))
  write(view)
  return [...new Uint8Array(view.buffer)]
}

describe("messageReader", () => {
  const read = (fields: string, ...data: number[]) =>
    messageReader(
      parse(`package ex;
        enum Role { ROLE_UNKNOWN = 0; ADMIN = 1; }
        message Inner { int32 n = 1; }
        message T { ${fields} }`),
      "ex.T",
    )(new Uint8Array(data))

  it("names fields and reads strings and ints", () => {
    expect(
      read(
        "string name = 1; int32 id = 2;",
        0x0a,
        2,
        0x68,
        0x69,
        0x10,
        0x96,
        1,
      ),
    ).toEqual({ name: "hi", id: 150 })
    expect(read("int32 v = 1;", 0x08, ...varint(2n ** 64n - 1n))).toEqual({
      v: -1,
    })
  })

  it("reads sint, uint64 and bool by type", () => {
    expect(read("sint32 v = 1;", 0x08, 3)).toEqual({ v: -2 })
    expect(read("uint64 v = 1;", 0x08, ...varint(2n ** 60n))).toEqual({
      v: "1152921504606846976",
    })
    expect(read("bool v = 1;", 0x08, 1)).toEqual({ v: true })
  })

  it("names enum values, keeping unknown numbers", () => {
    expect(read("Role r = 1;", 0x08, 1)).toEqual({ r: "ADMIN" })
    expect(read("Role r = 1;", 0x08, 7)).toEqual({ r: 7 })
  })

  it("reads bytes as hex and nested messages by name", () => {
    expect(read("bytes b = 1;", 0x0a, 2, 0xff, 0xfe)).toEqual({ b: "ff fe" })
    expect(read("Inner i = 1;", 0x0a, 2, 0x08, 5)).toEqual({ i: { n: 5 } })
  })

  it("reads fixed-width types by type", () => {
    expect(
      read("float f = 1;", 0x0d, ...le(4, (v) => v.setFloat32(0, 1.5, true))),
    ).toEqual({ f: 1.5 })
    expect(
      read("double d = 1;", 0x09, ...le(8, (v) => v.setFloat64(0, 3.14, true))),
    ).toEqual({ d: 3.14 })
    expect(
      read("sfixed32 s = 1;", 0x0d, ...le(4, (v) => v.setInt32(0, -1, true))),
    ).toEqual({ s: -1 })
  })

  it("keeps unknown fields numbered and well-known types schema-less", () => {
    expect(read("int32 a = 1;", 0x48, 5)).toEqual({ "9": 5 })
    expect(read("google.protobuf.Timestamp at = 1;", 0x0a, 2, 0x08, 5)).toEqual(
      { at: { "1": 5 } },
    )
  })
})

describe("messageReader repeated and maps", () => {
  const read = (fields: string, ...data: number[]) =>
    messageReader(
      parse(`package ex;
        enum Role { ROLE_UNKNOWN = 0; ADMIN = 1; }
        message Inner { int32 n = 1; }
        message T { ${fields} }`),
      "ex.T",
    )(new Uint8Array(data))

  it("reads repeated scalars packed or not, always as arrays", () => {
    expect(read("repeated int32 s = 1;", 0x0a, 2, 5, 7)).toEqual({ s: [5, 7] })
    expect(read("repeated int32 s = 1;", 0x08, 5, 0x08, 7)).toEqual({
      s: [5, 7],
    })
    expect(read("repeated int32 s = 1;", 0x08, 5)).toEqual({ s: [5] })
  })

  it("reads repeated messages", () => {
    expect(
      read("repeated Inner i = 1;", 0x0a, 2, 0x08, 1, 0x0a, 2, 0x08, 2),
    ).toEqual({ i: [{ n: 1 }, { n: 2 }] })
  })

  it("reads maps as objects", () => {
    expect(
      read(
        "map<string, int32> m = 1;",
        ...[0x0a, 5, 0x0a, 1, 0x61, 0x10, 1],
        ...[0x0a, 5, 0x0a, 1, 0x62, 0x10, 2],
      ),
    ).toEqual({ m: { a: 1, b: 2 } })
    expect(read("map<int32, Role> m = 1;", 0x0a, 4, 0x08, 1, 0x10, 1)).toEqual({
      m: { "1": "ADMIN" },
    })
  })
})
