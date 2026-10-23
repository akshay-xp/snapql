import { describe, expect, it } from "vitest"
import { parseProto } from "./proto-schema"

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
