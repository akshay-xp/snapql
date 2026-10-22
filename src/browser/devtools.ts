import type { Body, FinishedRequest } from "../capture/entry"

export function createPanel(title: string, iconPath: string, pagePath: string) {
  chrome.devtools.panels.create(title, iconPath, pagePath)
}

export function toFinishedRequest(
  req: chrome.devtools.network.Request,
): FinishedRequest {
  const postData = req.request.postData
  return {
    method: req.request.method,
    url: req.request.url,
    status: req.response.status,
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
