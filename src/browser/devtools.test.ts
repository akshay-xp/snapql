import { afterEach, describe, expect, it, vi } from "vitest"
import {
  getHAR,
  getTheme,
  onNavigated,
  onRequestFinished,
  onThemeChanged,
  toFinishedRequest,
} from "./devtools"

function chromeRequest(postData?: { mimeType: string; text: string }) {
  return {
    request: { method: "POST", url: "https://api.test/graphql", postData },
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

  it("passes the request body through", () => {
    const postData = { mimeType: "application/json", text: "{}" }

    expect(toFinishedRequest(chromeRequest(postData)).requestBody).toEqual(
      postData,
    )
    expect(toFinishedRequest(chromeRequest()).requestBody).toBeUndefined()
  })
})

describe("response mime type", () => {
  it("maps response.content.mimeType, defaulting to empty", () => {
    const req = chromeRequest()
    expect(toFinishedRequest(req).mimeType).toBe("")

    req.response.content = { mimeType: "application/json", size: 0 }
    expect(toFinishedRequest(req).mimeType).toBe("application/json")
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

describe("getHAR", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("resolves to the HAR entries as finished requests", async () => {
    vi.stubGlobal("chrome", {
      devtools: {
        network: {
          getHAR: (cb: (har: { entries: unknown[] }) => void) =>
            cb({ entries: [chromeRequest()] }),
        },
      },
    })

    const requests = await getHAR()

    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      url: "https://api.test/graphql",
      status: 201,
    })
  })
})

describe("onNavigated", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("calls back on navigation and removes the same listener", () => {
    const addListener = vi.fn()
    const removeListener = vi.fn()
    vi.stubGlobal("chrome", {
      devtools: { network: { onNavigated: { addListener, removeListener } } },
    })
    const cb = vi.fn()

    const off = onNavigated(cb)
    const listener = addListener.mock.calls[0][0]
    listener("https://x/")

    expect(cb).toHaveBeenCalledTimes(1)

    off()
    expect(removeListener).toHaveBeenCalledWith(listener)
  })
})

describe("getTheme", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ["dark", "dark"],
    ["default", "light"],
    [undefined, "light"],
  ])("maps themeName %s to %s", (themeName, kind) => {
    vi.stubGlobal("chrome", { devtools: { panels: { themeName } } })

    expect(getTheme()).toBe(kind)
  })
})

describe("onThemeChanged", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses the Firefox theme event when present", () => {
    const addListener = vi.fn()
    const removeListener = vi.fn()
    vi.stubGlobal("chrome", {
      devtools: {
        panels: { onThemeChanged: { addListener, removeListener } },
      },
    })
    const cb = vi.fn()

    const off = onThemeChanged(cb)
    const listener = addListener.mock.calls[0][0]
    listener("dark")

    expect(cb).toHaveBeenCalledWith("dark")
    off()
    expect(removeListener).toHaveBeenCalledWith(listener)
  })

  it("does nothing without the Firefox event", () => {
    const matchMedia = vi.fn()
    vi.stubGlobal("chrome", { devtools: { panels: { themeName: "dark" } } })
    vi.stubGlobal("matchMedia", matchMedia)
    const cb = vi.fn()

    onThemeChanged(cb)()

    expect(matchMedia).not.toHaveBeenCalled()
    expect(cb).not.toHaveBeenCalled()
  })
})
