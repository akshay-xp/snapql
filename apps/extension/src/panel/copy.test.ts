import { afterEach, describe, expect, it, vi } from "vitest"
import { copyToClipboard, pairsText, valueText } from "./copy"

describe("valueText", () => {
  it("keeps strings and pretty-prints everything else", () => {
    expect(valueText("query A { a }")).toBe("query A { a }")
    expect(valueText({ id: 1 })).toBe('{\n  "id": 1\n}')
    expect(valueText([1])).toBe("[\n  1\n]")
    expect(valueText(3)).toBe("3")
  })
})

describe("pairsText", () => {
  it("writes one name = value line per pair", () => {
    expect(
      pairsText([
        { name: "a", value: "1" },
        { name: "b", value: "x y" },
      ]),
    ).toBe("a = 1\nb = x y")
    expect(pairsText([])).toBe("")
  })
})

describe("copyToClipboard", () => {
  afterEach(() => vi.unstubAllGlobals())

  const fakeDocument = () => {
    const textarea = {
      value: "",
      style: {},
      select: vi.fn(),
      remove: vi.fn(),
    }
    const doc = {
      createElement: vi.fn(() => textarea),
      body: { append: vi.fn() },
      execCommand: vi.fn(() => true),
    }
    vi.stubGlobal("document", doc)
    return { doc, textarea }
  }

  it("uses the Clipboard API when it works", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    const { doc } = fakeDocument()

    await copyToClipboard("hi")

    expect(writeText).toHaveBeenCalledWith("hi")
    expect(doc.createElement).not.toHaveBeenCalled()
  })

  it("falls back to execCommand when the API rejects or is missing", async () => {
    for (const nav of [
      { clipboard: { writeText: () => Promise.reject(new Error("blocked")) } },
      {},
    ]) {
      vi.stubGlobal("navigator", nav)
      const { doc, textarea } = fakeDocument()

      await copyToClipboard("hi")

      expect(doc.body.append).toHaveBeenCalledWith(textarea)
      expect(textarea.value).toBe("hi")
      expect(textarea.select).toHaveBeenCalled()
      expect(doc.execCommand).toHaveBeenCalledWith("copy")
      expect(textarea.remove).toHaveBeenCalled()
    }
  })
})
