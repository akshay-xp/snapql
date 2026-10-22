import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { chromium, type Page } from "playwright"

const extensionDir = resolve("dist/chrome")

const rowText = `(o) => o.innerText.replace(/\\s+/g, " ").trim()`

// One request per M3 decoder; issues add theirs here.
const decodersPage = `<!doctype html>
<link rel="icon" href="data:,">
<script>
  fetch("/api/users/1")
  fetch("/api/form", { method: "POST", body: new URLSearchParams({ a: "1", b: "x y" }) })
</script>`

// No favicon request, so the last row is the last item.
const bulkPage = `<!doctype html>
<link rel="icon" href="data:,">
<script>
  ;(async () => {
    for (let i = 0; i < 1000; i++) await fetch("/api/item?i=" + i)
    document.title = "done"
  })()
</script>`

const testPage = `<!doctype html>
<script>
  fetch("/api/one")
    .then(() =>
      fetch("/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "query GetUser { user { id } }",
          variables: { id: "1" },
        }),
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
  optionCount(): Promise<number>
  dragDivider(dx: number): Promise<void>
  paneWidths(): Promise<{ list: number; detail: number }>
  selectedVisible(): Promise<boolean>
  press(key: string): Promise<void>
  select(row: string): Promise<void>
  selectedRow(): Promise<string | undefined>
  activeTab(): Promise<string | undefined>
  openTab(name: string): Promise<void>
  pressTab(key: string): Promise<void>
  detail(): Promise<string | null>
  themeKind(): Promise<string | undefined>
  devtoolsTheme(): Promise<"light" | "dark">
  cssVar(name: string): Promise<string>
  clear(): Promise<void>
  togglePreserveLog(): Promise<void>
  close(): Promise<void>
}

export async function openPanel(
  options: { visitFirst?: boolean; devtoolsTheme?: "light" | "dark" } = {},
): Promise<Panel> {
  const server = await startServer()
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const userDataDir = await mkdtemp(join(tmpdir(), "snapql-e2e-"))
  if (options.devtoolsTheme) {
    // Headless DevTools ignores emulated color schemes; its own setting works.
    const ui = options.devtoolsTheme === "dark" ? "dark" : "default"
    await mkdir(join(userDataDir, "Default"))
    await writeFile(
      join(userDataDir, "Default", "Preferences"),
      JSON.stringify({
        devtools: { preferences: { "ui-theme": JSON.stringify(ui) } },
      }),
    )
  }
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
  const panelId = await poll(() =>
    devtools.evaluate<string | undefined>(`(async () => {
      const { InspectorView } = await import("./ui/legacy/legacy.js")
      return InspectorView.InspectorView.instance()
        .tabbedPane.tabIds().find((id) => id.includes("SnapQL"))
    })()`),
  )
  // Visit only once DevTools is up, or it never records the requests.
  if (options.visitFirst) {
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/two")),
      page.goto(origin),
    ])
  }
  await devtools.evaluate(`(async () => {
    const { InspectorView } = await import("./ui/legacy/legacy.js")
    await InspectorView.InspectorView.instance().showPanel(${JSON.stringify(panelId)})
  })()`)
  const panelFrame = await connect(port, (t) => t.url.endsWith("/panel.html"))
  await poll(() =>
    panelFrame
      .evaluate<boolean>(`!!document.querySelector("main")`)
      .then((ok) => ok || undefined),
  )

  return {
    page,
    origin,
    themeKind: () =>
      panelFrame.evaluate<string | undefined>(
        "document.documentElement.dataset.themeKind",
      ),
    devtoolsTheme: () =>
      devtools.evaluate<"light" | "dark">(
        `document.documentElement.classList.contains("theme-with-dark-background") ? "dark" : "light"`,
      ),
    cssVar: (name: string) =>
      panelFrame.evaluate<string>(
        `getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(name)}).trim()`,
      ),
    rows: () =>
      panelFrame.evaluate<string[]>(
        `[...document.querySelectorAll('[role="option"]')].map(${rowText})`,
      ),
    dragDivider: (dx: number) =>
      panelFrame.evaluate<void>(`(() => {
        const sep = document.querySelector('hr[aria-orientation="vertical"]')
        const r = sep.getBoundingClientRect()
        const x = r.left + r.width / 2
        const y = r.top + r.height / 2
        const at = (clientX) => ({ bubbles: true, clientX, clientY: y, pointerId: 1 })
        sep.dispatchEvent(new PointerEvent("pointerdown", at(x)))
        window.dispatchEvent(new PointerEvent("pointermove", at(x + ${dx})))
        window.dispatchEvent(new PointerEvent("pointerup", at(x + ${dx})))
      })()`),
    paneWidths: () =>
      panelFrame.evaluate<{ list: number; detail: number }>(`({
        list: document.querySelector('[role="listbox"]').getBoundingClientRect().width,
        detail: document.querySelector('[role="tablist"]').closest("section").getBoundingClientRect().width,
      })`),
    optionCount: () =>
      panelFrame.evaluate<number>(
        `document.querySelectorAll('[role="option"]').length`,
      ),
    selectedVisible: () =>
      panelFrame.evaluate<boolean>(`(() => {
        const list = document.querySelector('[role="listbox"]').getBoundingClientRect()
        const row = document.querySelector('[role="option"][aria-selected="true"]')?.getBoundingClientRect()
        return !!row && row.top >= list.top && row.bottom <= list.bottom
      })()`),
    press: (key: string) =>
      panelFrame.evaluate<void>(`(() => {
        const list = document.querySelector('[role="listbox"]')
        list.focus()
        list.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, bubbles: true }))
      })()`),
    select: (row: string) =>
      panelFrame.evaluate<void>(
        `[...document.querySelectorAll('[role="option"]')].find((o) => (${rowText})(o) === ${JSON.stringify(row)}).click()`,
      ),
    activeTab: () =>
      panelFrame.evaluate<string | undefined>(
        `document.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim()`,
      ),
    openTab: (name: string) =>
      panelFrame.evaluate<void>(
        `[...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim() === ${JSON.stringify(name)}).click()`,
      ),
    pressTab: (key: string) =>
      panelFrame.evaluate<void>(`(() => {
        const tab = document.querySelector('[role="tab"][aria-selected="true"]')
        tab.focus()
        tab.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, bubbles: true }))
      })()`),
    detail: () =>
      panelFrame.evaluate<string | null>(
        `document.querySelector('[role="tabpanel"]')?.innerText ?? null`,
      ),
    selectedRow: () =>
      panelFrame.evaluate<string | undefined>(`(() => {
        const list = document.querySelector('[role="listbox"]')
        const option = document.querySelector('[role="option"][aria-selected="true"]')
        if (!option || list.getAttribute("aria-activedescendant") !== option.id) return undefined
        return (${rowText})(option)
      })()`),
    clear: () =>
      panelFrame.evaluate<void>(
        `[...document.querySelectorAll("button")].find((b) => b.textContent === "Clear").click()`,
      ),
    togglePreserveLog: () =>
      panelFrame.evaluate<void>(
        `[...document.querySelectorAll("label")].find((l) => l.textContent.trim() === "Preserve log").querySelector("input").click()`,
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
    if (req.url === "/api/three") return res.writeHead(200).end("three")
    if (req.url?.startsWith("/api/item")) return res.writeHead(200).end("item")
    if (req.url === "/api/users/1")
      return res
        .writeHead(200, { "content-type": "application/json" })
        .end('{"id":1}')
    if (req.url?.startsWith("/api/form")) return res.writeHead(200).end("ok")
    if (req.url === "/decoders")
      return res
        .writeHead(200, { "content-type": "text/html" })
        .end(decodersPage)
    if (req.url === "/bulk")
      return res.writeHead(200, { "content-type": "text/html" }).end(bulkPage)
    if (req.url === "/other")
      return res
        .writeHead(200, { "content-type": "text/html" })
        .end(`<!doctype html><script>fetch("/api/three")</script>`)
    if (new URL(req.url ?? "", "http://x").pathname === "/graphql")
      return res
        .writeHead(200, { "content-type": "application/json" })
        .end('{"data":{}}')
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
