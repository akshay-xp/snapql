import { describe, expect, it } from "vitest"
import { type StreamEvent, streamParser } from "./stream"

function parse(mimeType: string, ...chunks: string[]): StreamEvent[] {
  const parser = streamParser(mimeType)
  expect(parser).toBeDefined()
  if (!parser) return []
  return [...chunks.flatMap((c) => parser.push(c)), ...parser.end()]
}

function expectAnySplit(mimeType: string, text: string) {
  const whole = parse(mimeType, text)
  for (let i = 0; i <= text.length; i++)
    expect(parse(mimeType, text.slice(0, i), text.slice(i))).toEqual(whole)
}

const sse = "text/event-stream"

describe("event-stream", () => {
  it("dispatches data on a blank line", () => {
    expect(parse(sse, 'data: {"a":1}\n\n')).toEqual([{ text: '{"a":1}' }])
  })

  it("joins data lines and reads event and id", () => {
    expect(parse(sse, "event: ping\nid: 7\ndata: one\ndata: two\n\n")).toEqual([
      { text: "one\ntwo", event: "ping", id: "7" },
    ])
  })

  it("ignores comments and retry, and strips only one leading space", () => {
    expect(parse(sse, ":comment\nretry: 10\ndata:x\n\ndata:  y\n\n")).toEqual([
      { text: "x" },
      { text: " y" },
    ])
  })

  it("accepts CRLF, LF and CR line endings", () => {
    const events = [{ text: "a" }, { text: "b" }]
    expect(parse(sse, "data: a\r\n\r\ndata: b\r\n\r\n")).toEqual(events)
    expect(parse(sse, "data: a\n\ndata: b\n\n")).toEqual(events)
    expect(parse(sse, "data: a\r\rdata: b\r\r")).toEqual(events)
  })

  it("skips blocks without data and keeps a trailing event", () => {
    expect(parse(sse, "event: ping\n\ndata: last")).toEqual([{ text: "last" }])
  })

  it("gives the same events however the text is split", () => {
    expectAnySplit(
      sse,
      "event: ping\r\ndata: one\r\ndata: two\r\n\r\n:c\rdata: b\r\rdata: c",
    )
  })
})

describe("NDJSON and JSON Lines", () => {
  const text = '{"a":1}\n\n{"b":2}\r\n{"c":3}'
  const events = [{ text: '{"a":1}' }, { text: '{"b":2}' }, { text: '{"c":3}' }]

  it("gives one event per non-empty line", () => {
    expect(parse("application/x-ndjson", text)).toEqual(events)
    expect(parse("application/jsonl; charset=utf-8", text)).toEqual(events)
  })

  it("gives the same events however the text is split", () => {
    expectAnySplit("application/x-ndjson", text)
  })

  it("has no parser for other mime types", () => {
    expect(streamParser("application/json")).toBeUndefined()
    expect(streamParser("")).toBeUndefined()
  })
})

describe("multipart/mixed", () => {
  const first = '{"data":{"user":{"id":"1"}},"hasNext":true}'
  const second =
    '{"incremental":[{"data":{"name":"Ada"},"path":["user"]}],"hasNext":false}'
  const text = [
    "",
    "---",
    "Content-Type: application/json; charset=utf-8",
    "",
    first,
    "---",
    "Content-Type: application/json; charset=utf-8",
    "",
    second,
    "-----",
    "",
    "ignored",
  ].join("\r\n")
  const events = [{ text: first }, { text: second }]

  it("gives one event per part body, boundary from the mime", () => {
    expect(parse('multipart/mixed; boundary="-"', text)).toEqual(events)
  })

  it("takes the boundary from the body when the mime has none", () => {
    expect(parse("multipart/mixed", text)).toEqual(events)
  })

  it("gives the same events however the text is split", () => {
    expectAnySplit('multipart/mixed; boundary="-"', text)
    expectAnySplit("multipart/mixed", text)
  })
})
