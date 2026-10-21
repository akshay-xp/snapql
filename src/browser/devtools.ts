import type { Body, FinishedRequest } from "../capture/entry"

export function createPanel(title: string, iconPath: string, pagePath: string) {
  chrome.devtools.panels.create(title, iconPath, pagePath)
}

export function toFinishedRequest(
  req: chrome.devtools.network.Request,
): FinishedRequest {
  return {
    method: req.request.method,
    url: req.request.url,
    status: req.response.status,
    startedDateTime: req.startedDateTime,
    time: req.time,
    // Callback form: the promise overload is not guaranteed in Firefox's chrome.* namespace.
    fetchBody: () =>
      new Promise<Body>((resolve) =>
        req.getContent((content, encoding) => resolve({ content, encoding })),
      ),
  }
}
