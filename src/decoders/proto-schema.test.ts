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
