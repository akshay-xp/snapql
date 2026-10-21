import { afterEach, describe, expect, it, vi } from "vitest"
import { onRequestFinished, toFinishedRequest } from "./devtools"

function chromeRequest() {
  return {
    request: { method: "POST", url: "https://api.test/graphql" },
    response: { status: 201 },
    startedDateTime: "2026-10-22T10:00:00.000Z",
    time: 3,
    getContent: vi.fn((cb: (content: string, encoding: string) => void) =>
      cb("e30=", "base64"),
    ),
  } as unknown as chrome.devtools.network.Request & {
    getContent: ReturnType<typeof vi.fn>
  }
}

describe("toFinishedRequest", () => {
  it("maps fields and reads the body only on demand", async () => {
    const req = chromeRequest()
    const finished = toFinishedRequest(req)

    expect(finished).toMatchObject({
      method: "POST",
      url: "https://api.test/graphql",
      status: 201,
      startedDateTime: "2026-10-22T10:00:00.000Z",
      time: 3,
    })
    expect(req.getContent).not.toHaveBeenCalled()
    await expect(finished.fetchBody()).resolves.toEqual({
      content: "e30=",
      encoding: "base64",
    })
  })
})

describe("onRequestFinished", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("delivers mapped requests and removes the same listener", () => {
    const addListener = vi.fn()
    const removeListener = vi.fn()
    vi.stubGlobal("chrome", {
      devtools: {
        network: { onRequestFinished: { addListener, removeListener } },
      },
    })
    const cb = vi.fn()

    const off = onRequestFinished(cb)
    const listener = addListener.mock.calls[0][0]
    listener(chromeRequest())

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://api.test/graphql" }),
    )

    off()
    expect(removeListener).toHaveBeenCalledWith(listener)
  })
})
