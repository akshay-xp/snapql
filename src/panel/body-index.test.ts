import { describe, expect, it, vi } from "vitest"
import type { Body, Entry } from "../capture/entry"
import { createBodyIndex } from "./body-index"

const fake = (
  body: Promise<Body>,
  mimeType = "application/json",
  request?: string,
) =>
  ({
    getBody: vi.fn(() => body),
    mimeType,
    ...(request !== undefined && {
      requestBody: { text: request, mimeType: "application/json" },
    }),
  }) as unknown as Entry

const text = (content: string): Promise<Body> =>
  Promise.resolve({ content, encoding: "" })

function index() {
  let resolve!: () => void
  let changed = new Promise<void>((r) => {
    resolve = r
  })
  const bodies = createBodyIndex(() => {
    resolve()
    changed = new Promise<void>((r) => {
      resolve = r
    })
  })
  return { bodies, changed: () => changed }
}

describe("createBodyIndex", () => {
  it("fetches nothing while off", () => {
    const a = fake(text("res"))
    const { bodies } = index()
    bodies.sync([a], false)
    expect(a.getBody).not.toHaveBeenCalled()
    expect(bodies.text(a)).toBeUndefined()
  })

  it("indexes request and response text once per body", async () => {
    const a = fake(text('{"geo":1}'), "application/json", "req")
    const { bodies, changed } = index()
    const done = changed()
    bodies.sync([a], true)
    await done
    expect(bodies.text(a)).toBe('req\n{"geo":1}')

    const b = fake(text("b"))
    const later = changed()
    bodies.sync([a, b, { ...a }], true)
    await later
    expect(b.getBody).toHaveBeenCalledOnce()
    expect(a.getBody).toHaveBeenCalledOnce()
    expect(bodies.text({ ...a })).toBe(bodies.text(a))
  })

  it("indexes only request text for binary and failed bodies", async () => {
    const png = fake(
      Promise.resolve({ content: "iVBORw0K", encoding: "base64" }),
      "image/png",
      "p",
    )
    const failed = fake(Promise.reject(new Error("gone")), "", "f")
    const { bodies, changed } = index()
    const first = changed()
    bodies.sync([png], true)
    await first
    const second = changed()
    bodies.sync([failed], true)
    await second
    expect(bodies.text(png)).toBe("p\n")
    expect(bodies.text(failed)).toBe("f\n")
  })
})
