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
