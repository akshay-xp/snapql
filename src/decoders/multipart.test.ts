import { describe, expect, it } from "vitest"
import { multipart, parseMultipart } from "./multipart"
import type { RequestView } from "./types"

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

function post(
  text: string,
  mimeType = "multipart/form-data; boundary=X",
): RequestView {
  return {
    method: "POST",
    url: "https://x/upload",
    status: 200,
    mimeType: "text/html",
    requestBody: { mimeType, text },
  }
}

const file = (headers: string, content: string) =>
  `--X\r\nContent-Disposition: form-data; name="f"; filename="f.txt"${headers}\r\n\r\n${content}\r\n--X--`

describe("multipart", () => {
  it("counts fields and files and lists them as rows", () => {
    expect(multipart.decode(post(body))).toEqual({
      summary: "2 fields, 1 file",
      data: {
        fields: [
          { name: "a", value: "1" },
          { name: "b", value: "two\r\nlines" },
        ],
        files: [{ name: "f", value: "f.txt (text/plain, 2 bytes)" }],
      },
    })
  })

  it("sizes files in UTF-8 bytes, or unknown when omitted", () => {
    const files = (text: string) =>
      (multipart.decode(post(text))?.data as { files: unknown } | undefined)
        ?.files
    expect(files(file("\r\nContent-Type: text/plain", "é"))).toEqual([
      { name: "f", value: "f.txt (text/plain, 2 bytes)" },
    ])
    expect(files(file("\r\nContent-Type: text/plain", ""))).toEqual([
      { name: "f", value: "f.txt (text/plain, size unknown)" },
    ])
    expect(files(file("", "x"))).toEqual([
      { name: "f", value: "f.txt (application/octet-stream, 1 byte)" },
    ])
  })

  it("summarizes only the counts present", () => {
    const field =
      '--X\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n--X--'
    expect(multipart.decode(post(field))?.summary).toBe("1 field")
    expect(multipart.decode(post(file("", "x")))?.summary).toBe("1 file")
  })

  it("reads a quoted boundary", () => {
    expect(
      multipart.decode(post(body, 'multipart/form-data; boundary="X"'))
        ?.summary,
    ).toBe("2 fields, 1 file")
  })

  it("ignores bodies without a boundary or of another type", () => {
    expect(multipart.decode(post(body, "multipart/form-data"))).toBeUndefined()
    expect(multipart.decode(post(body, "text/plain"))).toBeUndefined()
  })
})
