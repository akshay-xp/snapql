import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { chromium, type Page } from "playwright"

const extensionDir = resolve("dist/chrome")

const testPage = `<!doctype html>
<script>
  fetch("/api/one")
    .then(() =>
      fetch("/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "query GetUser { user { id } }" }),
      }),
    )
    .then(() =>
      fetch(
        "/graphql?" +
          new URLSearchParams({
            operationName: "GetUser",
            extensions: JSON.stringify({
              persistedQuery: { version: 1, sha256Hash: "abcdef1234567890" },
            }),
          }),
      ),
    )
    .then(() => fetch("/api/two", { method: "POST" }))
</script>`

export type Panel = {
  page: Page
  origin: string
  rows(): Promise<string[]>
  clear(): Promise<void>
  close(): Promise<void>
}

export async function openPanel(): Promise<Panel> {
  const server = await startServer()
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const userDataDir = await mkdtemp(join(tmpdir(), "snapql-e2e-"))
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      "--auto-open-devtools-for-tabs",
      "--remote-debugging-port=0",
    ],
  })
  const page = context.pages()[0] ?? (await context.newPage())

  const port = await poll(async () => {
    const file = await readFile(
      join(userDataDir, "DevToolsActivePort"),
      "utf8",
    ).catch(() => "")
    return file.split("\n")[0] || undefined
  })
  const devtools = await connect(port, (t) => t.url.startsWith("devtools://"))
  await poll(() =>
    devtools.evaluate<string | undefined>(`(async () => {
      const { InspectorView } = await import("./ui/legacy/legacy.js")
      const view = InspectorView.InspectorView.instance()
      const id = view.tabbedPane.tabIds().find((id) => id.includes("SnapQL"))
      if (id) await view.showPanel(id)
      return id
    })()`),
  )
  const panelFrame = await connect(port, (t) => t.url.endsWith("/panel.html"))
  await poll(() =>
    panelFrame
      .evaluate<boolean>(`!!document.querySelector("main")`)
      .then((ok) => ok || undefined),
  )

  return {
    page,
    origin,
    rows: () =>
      panelFrame.evaluate<string[]>(
        `[...document.querySelectorAll("li")].map((li) => li.innerText.replace(/\\s+/g, " ").trim())`,
      ),
    clear: () =>
      panelFrame.evaluate<void>(
        `[...document.querySelectorAll("button")].find((b) => b.textContent === "Clear").click()`,
      ),
    close: async () => {
      devtools.close()
      panelFrame.close()
      await context.close()
      server.close()
      await rm(userDataDir, { recursive: true, force: true })
    },
  }
}

function startServer(): Promise<Server> {
  const server = createServer((req, res) => {
    if (req.url === "/api/one") return res.writeHead(200).end("one")
    if (req.url === "/api/two") return res.writeHead(201).end("two")
    if (new URL(req.url ?? "", "http://x").pathname === "/graphql")
      return res.writeHead(200).end('{"data":{}}')
    res.writeHead(200, { "content-type": "text/html" }).end(testPage)
  })
  return new Promise((done) =>
    server.listen(0, "127.0.0.1", () => done(server)),
  )
}

type Target = { url: string; webSocketDebuggerUrl: string }

async function connect(port: string, match: (t: Target) => boolean) {
  const target = await poll(async () => {
    const targets: Target[] = await fetch(
      `http://127.0.0.1:${port}/json/list`,
    ).then((r) => r.json())
    return targets.find(match)
  })
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((done, fail) => {
    ws.onopen = done
    ws.onerror = fail
  })
  let nextId = 0
  const pending = new Map<number, (msg: CdpResponse) => void>()
  ws.onmessage = (event) => {
    const msg: CdpResponse = JSON.parse(event.data)
    pending.get(msg.id)?.(msg)
    pending.delete(msg.id)
  }

  return {
    evaluate<T>(expression: string): Promise<T> {
      const id = ++nextId
      ws.send(
        JSON.stringify({
          id,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      )
      return new Promise((done, fail) =>
        pending.set(id, (msg) => {
          const details = msg.result?.exceptionDetails
          if (details)
            fail(new Error(details.exception?.description ?? details.text))
          else done(msg.result?.result.value as T)
        }),
      )
    },
    close: () => ws.close(),
  }
}

type CdpResponse = {
  id: number
  result?: {
    result: { value?: unknown }
    exceptionDetails?: { text: string; exception?: { description?: string } }
  }
}

async function poll<T>(
  fn: () => Promise<T | undefined>,
  timeoutMs = 10000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  for (;;) {
    const value = await fn().catch((err) => {
      lastError = err
      return undefined
    })
    if (value !== undefined) return value
    if (Date.now() > deadline)
      throw new Error("poll timed out", { cause: lastError })
    await new Promise((r) => setTimeout(r, 100))
  }
}
