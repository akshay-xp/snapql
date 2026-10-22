import type { Body, FinishedRequest, NameValue } from "../capture/entry"

export function createPanel(title: string, iconPath: string, pagePath: string) {
  chrome.devtools.panels.create(title, iconPath, pagePath)
}

const pairs = (list?: NameValue[]): NameValue[] =>
  (list ?? []).map(({ name, value }) => ({ name, value }))

const ms = (n?: number) => n ?? -1

export function toFinishedRequest(
  req: chrome.devtools.network.Request,
): FinishedRequest {
  const postData = req.request.postData
  return {
    method: req.request.method,
    url: req.request.url,
    status: req.response.status,
    mimeType: req.response.content?.mimeType ?? "",
    exchange: {
      requestHeaders: pairs(req.request.headers),
      responseHeaders: pairs(req.response.headers),
      queryString: pairs(req.request.queryString),
      requestCookies: pairs(req.request.cookies),
      responseCookies: pairs(req.response.cookies),
      httpVersion: req.response.httpVersion ?? "",
      statusText: req.response.statusText ?? "",
      size: ms(req.response.content?.size),
      timings: {
        blocked: ms(req.timings?.blocked),
        dns: ms(req.timings?.dns),
        connect: ms(req.timings?.connect),
        ssl: ms(req.timings?.ssl),
        send: ms(req.timings?.send),
        wait: ms(req.timings?.wait),
        receive: ms(req.timings?.receive),
      },
    },
    requestBody:
      postData?.text === undefined
        ? undefined
        : { mimeType: postData.mimeType, text: postData.text },
    startedDateTime: req.startedDateTime,
    time: req.time,
    // Callback form: the promise overload is not guaranteed in Firefox's chrome.* namespace.
    fetchBody: () =>
      new Promise<Body>((resolve) =>
        req.getContent((content, encoding) => resolve({ content, encoding })),
      ),
  }
}

export function onRequestFinished(
  cb: (req: FinishedRequest) => void,
): () => void {
  const listener = (req: chrome.devtools.network.Request) =>
    cb(toFinishedRequest(req))
  chrome.devtools.network.onRequestFinished.addListener(listener)
  return () =>
    chrome.devtools.network.onRequestFinished.removeListener(listener)
}

export function getHAR(): Promise<FinishedRequest[]> {
  return new Promise((resolve) =>
    chrome.devtools.network.getHAR((har) =>
      resolve(
        // Chrome gives HAR entries the Request prototype, so getContent is there.
        (har.entries as chrome.devtools.network.Request[]).map(
          toFinishedRequest,
        ),
      ),
    ),
  )
}

export function onNavigated(cb: () => void): () => void {
  const listener = () => cb()
  chrome.devtools.network.onNavigated.addListener(listener)
  return () => chrome.devtools.network.onNavigated.removeListener(listener)
}

export type ThemeKind = "light" | "dark"

const toThemeKind = (name: string | undefined): ThemeKind =>
  name === "dark" ? "dark" : "light"

export function getTheme(): ThemeKind {
  return toThemeKind(chrome.devtools.panels.themeName)
}

type ThemeEvent = chrome.events.Event<(name: string) => void>

export function onThemeChanged(cb: (kind: ThemeKind) => void): () => void {
  // Firefox only. Chrome has no theme event, and its panel iframe's
  // prefers-color-scheme flips during load, so it can't stand in for one: the
  // theme read at load is kept until the panel reopens.
  const event = (chrome.devtools.panels as { onThemeChanged?: ThemeEvent })
    .onThemeChanged
  if (!event) return () => {}
  const listener = (name: string) => cb(toThemeKind(name))
  event.addListener(listener)
  return () => event.removeListener(listener)
}
