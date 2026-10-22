import type { Exchange } from "./entry"

export const emptyExchange: Exchange = {
  requestHeaders: [],
  responseHeaders: [],
  queryString: [],
  requestCookies: [],
  responseCookies: [],
  httpVersion: "",
  statusText: "",
  size: -1,
  timings: {
    blocked: -1,
    dns: -1,
    connect: -1,
    ssl: -1,
    send: -1,
    wait: -1,
    receive: -1,
  },
}
