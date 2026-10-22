import { describe, expect, it } from "vitest"
import { parseMultipart } from "./multipart"

const body = [
  "--X",
  'Content-Disposition: form-data; name="a"',
  "",
  "1",
  "--X",
  'Content-Disposition: form-data; name="b"',
  "",
  "two\r\nlines",
  "--X",
  'content-disposition: form-data; name="f"; filename="f.txt"',
  "Content-Type: text/plain",
  "",
  "hi",
  "--X--",
  "",
].join("\r\n")

describe("parseMultipart", () => {
  it("splits parts with names, files and contents", () => {
    expect(parseMultipart(body, "X")).toEqual([
      { name: "a", content: "1" },
      { name: "b", content: "two\r\nlines" },
      { name: "f", filename: "f.txt", type: "text/plain", content: "hi" },
    ])
  })

  it("accepts LF line endings", () => {
    const parts = parseMultipart(body.replace(/\r\n/g, "\n"), "X")
    expect(parts.map((p) => [p.name, p.content])).toEqual([
      ["a", "1"],
      ["b", "two\nlines"],
      ["f", "hi"],
    ])
  })

  it("skips parts without a name", () => {
    const text = "--X\r\nContent-Type: text/plain\r\n\r\nx\r\n--X--"
    expect(parseMultipart(text, "X")).toEqual([])
  })
})
