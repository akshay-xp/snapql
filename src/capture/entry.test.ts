import { describe, expect, it, vi } from "vitest"
import {
  appendMessages,
  type FinishedRequest,
  FRAME_LIMIT,
  MESSAGE_CAP,
  type Message,
  toEntry,
} from "./entry"
import { emptyExchange } from "./test-helpers"

function request(overrides: Partial<FinishedRequest> = {}): FinishedRequest {
  return {
    method: "POST",
    url: "https://api.test/graphql",
    status: 200,
    startedDateTime: "2026-10-22T10:00:00.000Z",
    time: 12.5,
    mimeType: "",
    exchange: emptyExchange,
    fetchBody: () => Promise.resolve({ content: "", encoding: "" }),
    ...overrides,
  }
}

describe("toEntry", () => {
  it("maps request fields", () => {
    const entry = toEntry(request(), 7)

    expect(entry).toMatchObject({
      id: 7,
      method: "POST",
      url: "https://api.test/graphql",
      status: 200,
      startedAt: Date.parse("2026-10-22T10:00:00.000Z"),
      time: 12.5,
    })
  })

  it("fetches the body lazily and only once", async () => {
    const body = { content: "{}", encoding: "" }
    const fetchBody = vi.fn(() => Promise.resolve(body))
    const entry = toEntry(request({ fetchBody }), 1)

    expect(fetchBody).not.toHaveBeenCalled()

    const [first, second] = await Promise.all([
      entry.getBody(),
      entry.getBody(),
    ])

    expect(fetchBody).toHaveBeenCalledTimes(1)
    expect(first).toBe(body)
    expect(second).toBe(body)
  })

  it("carries the response mime type", () => {
    expect(toEntry(request({ mimeType: "text/html" }), 1).mimeType).toBe(
      "text/html",
    )
  })

  it("carries the exchange", () => {
    const exchange = { ...emptyExchange, statusText: "OK" }
    expect(toEntry(request({ exchange }), 1).exchange).toBe(exchange)
  })

  it("carries the request body", () => {
    const requestBody = { mimeType: "application/json", text: "{}" }
    expect(toEntry(request({ requestBody }), 1).requestBody).toBe(requestBody)
  })
})

describe("appendMessages", () => {
  const texts = (from: number, to: number): Message[] =>
    Array.from({ length: to - from }, (_, i) => ({
      dir: "in",
      time: from + i,
      text: String(from + i),
    }))

  it("appends to a copy and keeps the body loader", async () => {
    const entry = toEntry(
      request({
        fetchBody: () => Promise.resolve({ content: "x", encoding: "" }),
      }),
      1,
    )
    const msgs: Message[] = [
      { dir: "in", time: 1, text: "a" },
      { dir: "out", time: 2, text: "b" },
    ]

    const next = appendMessages(entry, msgs)

    expect(next.messages).toEqual(msgs)
    expect(entry.messages).toBeUndefined()
    expect(await next.getBody()).toEqual({ content: "x", encoding: "" })
  })

  it("keeps the newest 2000 and counts what it drops", () => {
    expect(MESSAGE_CAP).toBe(2000)
    let entry = appendMessages(toEntry(request(), 1), texts(0, 1999))
    expect(entry.droppedMessages).toBeUndefined()

    entry = appendMessages(entry, texts(1999, 2002))
    expect(entry.messages).toHaveLength(2000)
    expect(entry.messages?.[0].text).toBe("2")
    expect(entry.messages?.at(-1)?.text).toBe("2001")
    expect(entry.droppedMessages).toBe(2)

    entry = appendMessages(entry, texts(2002, 2003))
    expect(entry.droppedMessages).toBe(3)
  })

  it("cuts frames over 1 MB and flags them", () => {
    expect(FRAME_LIMIT).toBe(1024 * 1024)
    const [long, exact] =
      appendMessages(toEntry(request(), 1), [
        { dir: "in", time: 1, text: "x".repeat(FRAME_LIMIT + 5) },
        { dir: "in", time: 2, text: "y".repeat(FRAME_LIMIT) },
      ]).messages ?? []

    expect(long.text.length).toBe(FRAME_LIMIT)
    expect(long.truncated).toBe(true)
    expect(exact.text.length).toBe(FRAME_LIMIT)
    expect(exact).not.toHaveProperty("truncated")
  })
})
