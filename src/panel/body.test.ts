import { describe, expect, it, vi } from "vitest"
import { BODY_LIMIT, formatBody, loadBody } from "./body"

const text = (content: string) => ({ content, encoding: "" })

describe("formatBody", () => {
  it("pretty-prints anything that parses as JSON", () => {
    expect(formatBody(text('{"a":1}'))).toEqual({
      text: '{\n  "a": 1\n}',
      notes: [],
    })
  })

  it("indents XML", () => {
    expect(formatBody(text("<a><b>1</b></a>"))).toEqual({
      text: "<a>\n  <b>1</b>\n</a>",
      notes: [],
    })
  })

  it("passes other text through", () => {
    expect(formatBody(text("hello"))).toEqual({ text: "hello", notes: [] })
    expect(formatBody(text("{bad"))).toEqual({ text: "{bad", notes: [] })
  })

  it("describes base64 bodies with their decoded size", () => {
    const base64 = (content: string) => ({ content, encoding: "base64" })

    expect(formatBody(base64("aGVsbG8="))).toEqual({
      text: "aGVsbG8=",
      notes: ["base64-encoded, 5 bytes"],
    })
    expect(formatBody(base64("aGk=")).notes).toEqual([
      "base64-encoded, 2 bytes",
    ])
    expect(formatBody(base64("aGVsbG8hIQ==")).notes).toEqual([
      "base64-encoded, 7 bytes",
    ])
  })

  it("truncates bodies over the limit without pretty-printing", () => {
    const content = `[${"1,".repeat((BODY_LIMIT + 8) / 2)}1]`

    const formatted = formatBody(text(content))

    expect(formatted.text).toBe(content.slice(0, BODY_LIMIT))
    expect(formatted.notes).toEqual([
      `Truncated: showing 1 MB of ${content.length} characters`,
    ])
  })
})

describe("formatBody without pretty-printing", () => {
  it("leaves XML as-is", () => {
    expect(formatBody(text("<a><b>1</b></a>"), { pretty: false }).text).toBe(
      "<a><b>1</b></a>",
    )
  })

  it("leaves JSON as-is but still truncates", () => {
    expect(formatBody(text('{"a":1}'), { pretty: false })).toEqual({
      text: '{"a":1}',
      notes: [],
    })
    const big = "x".repeat(BODY_LIMIT + 1)
    expect(formatBody(text(big), { pretty: false }).text).toHaveLength(
      BODY_LIMIT,
    )
  })
})

describe("loadBody", () => {
  it("fetches once and formats", async () => {
    const getBody = vi.fn(() => Promise.resolve(text('{"a":1}')))

    await expect(loadBody({ getBody })).resolves.toEqual({
      text: '{\n  "a": 1\n}',
      notes: [],
    })
    expect(getBody).toHaveBeenCalledTimes(1)
  })

  it("turns a failed fetch into a note", async () => {
    const getBody = () => Promise.reject(new Error("gone"))

    await expect(loadBody({ getBody })).resolves.toEqual({
      text: "",
      notes: ["Body unavailable: gone"],
    })
  })

  it("passes format options through", async () => {
    const getBody = () => Promise.resolve(text('{"a":1}'))
    await expect(loadBody({ getBody }, { pretty: false })).resolves.toEqual({
      text: '{"a":1}',
      notes: [],
    })
  })
})
