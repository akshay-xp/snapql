import { describe, expect, it, vi } from "vitest"
import { parseProto } from "../decoders/proto-schema"
import type { ProtoFile } from "../decoders/proto-types"
import { createSchemas } from "./schemas"

const memory = () => {
  const items = new Map<string, string>()
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    items,
  }
}
const compile = async (files: ProtoFile[]) => parseProto(files)
const a = {
  name: "a.proto",
  text: "package ex; message M {} service S { rpc Get(M) returns (M); }",
}

describe("createSchemas", () => {
  it("adds files and persists them with the compiled schema", async () => {
    const storage = memory()
    const schemas = createSchemas(storage, compile)
    await schemas.add([a])
    expect(schemas.files()).toEqual(["a.proto"])
    expect(Object.keys(schemas.schema().methods)).toEqual(["/ex.S/Get"])
    const stored = JSON.parse(storage.items.get("snapql.schemas") ?? "")
    expect(stored.files).toEqual([a])
    expect(stored.schema.methods).toEqual(schemas.schema().methods)
  })

  it("starts from storage without compiling", async () => {
    const storage = memory()
    await createSchemas(storage, compile).add([a])
    const spy = vi.fn(compile)
    const again = createSchemas(storage, spy)
    expect(again.files()).toEqual(["a.proto"])
    expect(Object.keys(again.schema().methods)).toEqual(["/ex.S/Get"])
    expect(spy).not.toHaveBeenCalled()
  })

  it("keeps the last good state when a file fails", async () => {
    const storage = memory()
    const schemas = createSchemas(storage, compile)
    await schemas.add([a])
    const before = storage.items.get("snapql.schemas")
    await schemas.add([{ name: "bad.proto", text: "message {" }])
    expect(schemas.error()).toMatch(/^bad\.proto:1: /)
    expect(schemas.files()).toEqual(["a.proto"])
    expect(storage.items.get("snapql.schemas")).toBe(before)
    await schemas.add([{ ...a, text: "package ex; message M {}" }])
    expect(schemas.error()).toBeUndefined()
  })

  it("replaces files by name and removes them", async () => {
    const schemas = createSchemas(memory(), compile)
    await schemas.add([a])
    await schemas.add([{ ...a, text: "package ex; message M {}" }])
    expect(schemas.files()).toEqual(["a.proto"])
    expect(schemas.schema().methods).toEqual({})
    await schemas.remove("a.proto")
    expect(schemas.files()).toEqual([])
  })

  it("works without usable storage", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied")
      },
      setItem: () => {
        throw new Error("denied")
      },
    }
    expect(createSchemas(broken, compile).files()).toEqual([])
    expect(createSchemas(undefined, compile).files()).toEqual([])
  })
})
