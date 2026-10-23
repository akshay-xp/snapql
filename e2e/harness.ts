import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { chromium, type Page } from "playwright"
import { WebSocketServer } from "ws"

const extensionDir = resolve("dist/chrome")

const rowText = `(o) => o.innerText.replace(/\\s+/g, " ").trim()`

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url")

const jwt = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: "42", name: "Ada", exp: 2000000000 })}.sig`

// One request per M3 decoder; issues add theirs here.
const decodersPage = `<!doctype html>
<link rel="icon" href="data:,">
<script>
  document.cookie = "greeting=hello%20world"
  fetch("/api/users/1")
  fetch("/api/form", { method: "POST", body: new URLSearchParams({ a: "1", b: "x y" }) })
  const upload = new FormData()
  upload.append("a", "1")
  upload.append("f", new Blob(["hi"], { type: "text/plain" }), "f.txt")
  fetch("/api/upload", { method: "POST", body: upload })
  fetch("/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '[{"query":"query A { a }"},{"query":"query B { b }"}]',
  })
  const gqlUpload = new FormData()
  gqlUpload.append("operations", '{"query":"mutation Upload($file: Upload!) { upload(file: $file) }","variables":{"file":null}}')
  gqlUpload.append("map", '{"0":["variables.file"]}')
  gqlUpload.append("0", new Blob(["hi"], { type: "text/plain" }), "a.txt")
  fetch("/graphql", { method: "POST", body: gqlUpload })
  fetch("/api/gql-errors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"query":"query Broken { user { posts { id } } }"}',
  })
  fetch("/api/gql-defer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"query":"query Deferred { user { id ... @defer { name } } }"}',
  })
  fetch("/api/missing")
  fetch("/api/me", { headers: { Authorization: "Bearer ${jwt}" } })
  fetch("/api/trpc/user.byId,post.list?batch=1&input=" + encodeURIComponent('{"0":{"id":1},"1":{}}'))
  fetch("/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"jsonrpc":"2.0","method":"sum","params":[1,2],"id":1}',
  })
  fetch("/api/soap", {
    method: "POST",
    headers: { "content-type": "text/xml; charset=utf-8" },
    body: '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header><a:Auth/></soap:Header><soap:Body><m:GetPrice><m:Item>Apples</m:Item></m:GetPrice></soap:Body></soap:Envelope>',
  })
</script>`

// No favicon request, so the last row is the last item.
const streamsPage = `<!doctype html>
<link rel="icon" href="data:,">
<script>
  fetch("/api/sse")
  fetch("/api/ndjson")
  fetch("/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "gpt-test", messages: [{ role: "user", content: "hi" }], stream: true }),
  })
</script>`

const chatChunk = (delta: object, finish_reason: string | null = null) =>
  JSON.stringify({ choices: [{ index: 0, delta, finish_reason }] })

const chatStream = [
  chatChunk({ role: "assistant", content: "Hel" }),
  chatChunk({ content: "lo" }),
  chatChunk({
    tool_calls: [
      {
        index: 0,
        id: "call_1",
        function: { name: "get_weather", arguments: "" },
      },
    ],
  }),
  chatChunk({ tool_calls: [{ index: 0, function: { arguments: '{"city"' } }] }),
  chatChunk({
    tool_calls: [{ index: 0, function: { arguments: ':"Paris"}' } }],
  }),
  chatChunk({}, "tool_calls"),
  "[DONE]",
]
  .map((data) => `data: ${data}\n\n`)
  .join("")

const livePage = `<!doctype html>
<link rel="icon" href="data:,">
<button id="es">es</button>
<button id="fetch">fetch</button>
<script>
  document.getElementById("es").onclick = () => {
    const es = new EventSource("/api/live")
    es.addEventListener("done", () => es.close())
  }
  document.getElementById("fetch").onclick = async () => {
    const res = await fetch("/api/live-fetch?n=20")
    await res.text()
  }
</script>`

// Opens its stream while loading, before the panel can inject the probe.
const earlyPage = `<!doctype html>
<link rel="icon" href="data:,">
<script>
  const es = new EventSource("/api/live?n=30")
  es.addEventListener("done", () => es.close())
</script>`

const socketPage = `<!doctype html>
<link rel="icon" href="data:,">
<button id="open">open</button>
<button id="close">close</button>
<button id="sio">sio</button>
<button id="gql">gql</button>
<script>
  const socket = (path, protocols, frames) => {
    const s = new WebSocket(location.origin.replace("http", "ws") + path, protocols)
    s.onopen = () => frames.forEach((f) => s.send(f))
  }
  document.getElementById("sio").onclick = () =>
    socket("/socket.io/?EIO=4&transport=websocket", [], [
      "40",
      '42["chat",{"text":"hi"}]',
      "2",
    ])
  document.getElementById("gql").onclick = () =>
    socket("/graphql-ws", ["graphql-transport-ws"], [
      '{"type":"connection_init"}',
      '{"type":"subscribe","id":"1","payload":{"query":"subscription OnMsg { msg }"}}',
      '{"type":"next","id":"1","payload":{"data":{"msg":"hi"}}}',
    ])
  let ws
  document.getElementById("open").onclick = () => {
    ws = new WebSocket(location.origin.replace("http", "ws") + "/sock", ["chat"])
    ws.onopen = () => {
      ws.send("hi")
      ws.send(new Uint8Array([1, 2, 3, 4]))
    }
  }
  document.getElementById("close").onclick = () => ws.close(1000, "bye")
</script>`

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

type Box = { top: number; bottom: number; left: number; right: number }

export type Panel = {
  page: Page
  origin: string
  rows(): Promise<string[]>
  optionCount(): Promise<number>
  dragDivider(dx: number, dy?: number): Promise<void>
  paneWidths(): Promise<{ list: number; detail: number }>
  selectedVisible(): Promise<boolean>
  press(key: string, list?: string): Promise<void>
  select(row: string): Promise<void>
  selectedRow(): Promise<string | undefined>
  // Clicks the first request row whose text starts with prefix (for rows that change).
  selectStarting(prefix: string): Promise<void>
  probed(): Promise<boolean>
  // Scrolls a listbox (by aria-label) to its top or bottom; scrollState reads it.
  scrollList(label: string, to: "top" | "bottom"): Promise<void>
  scrollState(label: string): Promise<{ top: number; gap: number }>
  activeTab(): Promise<string | undefined>
  openTab(name: string): Promise<void>
  messages(): Promise<string[]>
  pressTab(key: string): Promise<void>
  detail(): Promise<string | null>
  themeKind(): Promise<string | undefined>
  devtoolsTheme(): Promise<"light" | "dark">
  cssVar(name: string): Promise<string>
  style(selector: string, property: string): Promise<string>
  text(selector: string): Promise<string | null>
  attr(selector: string, name: string): Promise<string | null>
  clear(): Promise<void>
  toggleSort(): Promise<void>
  search(query: string): Promise<void>
  clearSearch(): Promise<void>
  clickButton(text: string): Promise<void>
  click(selector: string): Promise<void>
  pairs(): Promise<string>
  dock(side: "right" | "bottom"): Promise<void>
  // Visual review aid, not used by assertions.
  screenshot(file: string): Promise<void>
  paneBoxes(): Promise<{ list: Box; detail: Box }>
  // Text of matches whose content is wider than their box.
  overflowing(selector: string): Promise<string[]>
  stubClipboard(): Promise<void>
  copied(): Promise<string | undefined>
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
    dock: (side: "right" | "bottom") =>
      devtools.evaluate<void>(`(async () => {
        const { DockController } = await import("./ui/legacy/legacy.js")
        DockController.DockController.instance().setDockSide(${JSON.stringify(side)})
      })()`),
    screenshot: async (file: string) => {
      const { data } = await devtools.send<{ data: string }>(
        "Page.captureScreenshot",
        { format: "png" },
      )
      await writeFile(file, Buffer.from(data, "base64"))
    },
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
    style: (selector: string, property: string) =>
      panelFrame.evaluate<string>(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        return el ? getComputedStyle(el).getPropertyValue(${JSON.stringify(property)}) : ""
      })()`),
    text: (selector: string) =>
      panelFrame.evaluate<string | null>(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        return el ? (${rowText})(el) : null
      })()`),
    attr: (selector: string, name: string) =>
      panelFrame.evaluate<string | null>(
        `document.querySelector(${JSON.stringify(selector)})?.getAttribute(${JSON.stringify(name)}) ?? null`,
      ),
    rows: () =>
      panelFrame.evaluate<string[]>(
        `[...document.querySelectorAll('[aria-label="Requests"] [role="option"]')].map(${rowText})`,
      ),
    dragDivider: (dx: number, dy = 0) =>
      panelFrame.evaluate<void>(`(() => {
        const sep = document.querySelector("hr[aria-orientation]")
        const r = sep.getBoundingClientRect()
        const x = r.left + r.width / 2
        const y = r.top + r.height / 2
        const at = (dx, dy) => ({ bubbles: true, clientX: x + dx, clientY: y + dy, pointerId: 1 })
        sep.dispatchEvent(new PointerEvent("pointerdown", at(0, 0)))
        window.dispatchEvent(new PointerEvent("pointermove", at(${dx}, ${dy})))
        window.dispatchEvent(new PointerEvent("pointerup", at(${dx}, ${dy})))
      })()`),
    overflowing: (selector: string) =>
      panelFrame.evaluate<string[]>(
        `[...document.querySelectorAll(${JSON.stringify(selector)})].filter((el) => el.scrollWidth > el.clientWidth).map((el) => el.textContent)`,
      ),
    paneBoxes: () =>
      panelFrame.evaluate<{ list: Box; detail: Box }>(`(() => {
        const box = (el) => {
          const r = el.getBoundingClientRect()
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
        }
        return {
          list: box(document.querySelector('[role="listbox"][aria-label="Requests"]')),
          detail: box(document.querySelector('[role="tablist"]').closest("section")),
        }
      })()`),
    paneWidths: () =>
      panelFrame.evaluate<{ list: number; detail: number }>(`({
        list: document.querySelector('[role="listbox"][aria-label="Requests"]').getBoundingClientRect().width,
        detail: document.querySelector('[role="tablist"]').closest("section").getBoundingClientRect().width,
      })`),
    optionCount: () =>
      panelFrame.evaluate<number>(
        `document.querySelectorAll('[aria-label="Requests"] [role="option"]').length`,
      ),
    selectedVisible: () =>
      panelFrame.evaluate<boolean>(`(() => {
        const list = document.querySelector('[role="listbox"][aria-label="Requests"]').getBoundingClientRect()
        const row = document.querySelector('[aria-label="Requests"] [role="option"][aria-selected="true"]')?.getBoundingClientRect()
        return !!row && row.top >= list.top && row.bottom <= list.bottom
      })()`),
    press: (key: string, list = "Requests") =>
      panelFrame.evaluate<void>(`(() => {
        const list = document.querySelector('[role="listbox"][aria-label="${list}"]')
        list.focus()
        list.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, bubbles: true }))
      })()`),
    select: (row: string) =>
      panelFrame.evaluate<void>(
        `[...document.querySelectorAll('[aria-label="Requests"] [role="option"]')].find((o) => (${rowText})(o) === ${JSON.stringify(row)}).click()`,
      ),
    messages: () =>
      panelFrame.evaluate<string[]>(
        `[...document.querySelectorAll('[aria-label="Messages"] [role="option"]')].map(${rowText})`,
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
    selectStarting: (prefix: string) =>
      panelFrame.evaluate<void>(
        `[...document.querySelectorAll('[aria-label="Requests"] [role="option"]')].find((o) => (${rowText})(o).startsWith(${JSON.stringify(prefix)})).click()`,
      ),
    scrollList: (label: string, to: "top" | "bottom") =>
      panelFrame.evaluate<void>(`(() => {
        const list = document.querySelector('[role="listbox"][aria-label="${label}"]')
        list.scrollTop = ${to === "top" ? "0" : "list.scrollHeight"}
        list.dispatchEvent(new Event("scroll"))
      })()`),
    scrollState: (label: string) =>
      panelFrame.evaluate<{ top: number; gap: number }>(`(() => {
        const list = document.querySelector('[role="listbox"][aria-label="${label}"]')
        return { top: list.scrollTop, gap: list.scrollHeight - list.scrollTop - list.clientHeight }
      })()`),
    probed: () => page.evaluate(() => Symbol.for("snapql.probe") in window),
    selectedRow: () =>
      panelFrame.evaluate<string | undefined>(`(() => {
        const list = document.querySelector('[role="listbox"][aria-label="Requests"]')
        const option = document.querySelector('[aria-label="Requests"] [role="option"][aria-selected="true"]')
        if (!option || list.getAttribute("aria-activedescendant") !== option.id) return undefined
        return (${rowText})(option)
      })()`),
    clear: () =>
      panelFrame.evaluate<void>(
        `document.querySelector('button[aria-label="Clear"]').click()`,
      ),
    search: (query: string) =>
      panelFrame.evaluate<void>(`(() => {
        const input = document.querySelector('input[aria-label="Filter requests"]')
        input.value = ${JSON.stringify(query)}
        input.dispatchEvent(new Event("input", { bubbles: true }))
      })()`),
    clearSearch: () =>
      panelFrame.evaluate<void>(
        `document.querySelector('button[aria-label="Clear filter"]').click()`,
      ),
    stubClipboard: () =>
      panelFrame.evaluate<void>(
        `navigator.clipboard.writeText = async (text) => { window.__copied = text }`,
      ),
    copied: () => panelFrame.evaluate<string | undefined>("window.__copied"),
    pairs: () =>
      panelFrame.evaluate<string>(
        `[...document.querySelectorAll('[role="tabpanel"] dt')].map((dt) => dt.textContent + " = " + dt.nextElementSibling.querySelector("[data-value]").textContent).join("\\n")`,
      ),
    click: (selector: string) =>
      panelFrame.evaluate<void>(
        `document.querySelector(${JSON.stringify(selector)}).click()`,
      ),
    clickButton: (text: string) =>
      panelFrame.evaluate<void>(
        `[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)}).click()`,
      ),
    toggleSort: () =>
      panelFrame.evaluate<void>(
        `document.querySelector('button[aria-label="Newest first"], button[aria-label="Oldest first"]').click()`,
      ),
    togglePreserveLog: () =>
      panelFrame.evaluate<void>(
        `document.querySelector('button[aria-label="Preserve log"]').click()`,
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

async function startServer(): Promise<Server> {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "", "http://x")
    if (path.pathname.startsWith("/api/live")) {
      // Held open: n events (default 10) every ms (default 150), then "done", then the end.
      const total = Number(path.searchParams.get("n") ?? 10)
      const ms = Number(path.searchParams.get("ms") ?? 150)
      res.writeHead(200, { "content-type": "text/event-stream" })
      let n = 0
      const timer = setInterval(() => {
        if (++n <= total) return res.write(`data: {"n":${n}}\n\n`)
        clearInterval(timer)
        res.end("event: done\ndata: {}\n\n")
      }, ms)
      req.on("close", () => clearInterval(timer))
      return
    }
    if (req.url === "/socket")
      return res.writeHead(200, { "content-type": "text/html" }).end(socketPage)
    if (req.url === "/early")
      return res.writeHead(200, { "content-type": "text/html" }).end(earlyPage)
    if (req.url === "/live")
      return res.writeHead(200, { "content-type": "text/html" }).end(livePage)
    if (req.url === "/api/one") return res.writeHead(200).end("one")
    if (req.url === "/api/two") return res.writeHead(201).end("two")
    if (req.url === "/api/three") return res.writeHead(200).end("three")
    if (req.url === "/api/missing") return res.writeHead(404).end("missing")
    if (req.url?.startsWith("/api/item")) return res.writeHead(200).end("item")
    if (req.url === "/api/users/1")
      return res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          id: 1,
          bio: "b".repeat(250),
          profile: { address: { geo: { lat: 1 } } },
        }),
      )
    if (req.url?.startsWith("/api/form")) return res.writeHead(200).end("ok")
    if (req.url === "/api/upload") return res.writeHead(200).end("ok")
    if (req.url === "/api/me")
      return res
        .writeHead(200, { "content-type": "application/json" })
        .end('{"id":42}')
    if (req.url === "/api/gql-errors")
      return res
        .writeHead(200, { "content-type": "application/json" })
        .end(
          '{"data":{"user":null},"errors":[{"message":"boom","path":["user","posts",0]},{"message":"bad"}]}',
        )
    if (req.url === "/api/gql-defer")
      return res
        .writeHead(200, { "content-type": 'multipart/mixed; boundary="-"' })
        .end(
          [
            "",
            "---",
            "Content-Type: application/json; charset=utf-8",
            "",
            '{"data":{"user":{"id":"1"}},"hasNext":true}',
            "---",
            "Content-Type: application/json; charset=utf-8",
            "",
            '{"incremental":[{"data":{"name":"Ada"},"path":["user"]}],"hasNext":false}',
            "-----",
            "",
          ].join("\r\n"),
        )
    if (req.url?.startsWith("/api/trpc/"))
      return res
        .writeHead(200, { "content-type": "application/json" })
        .end('[{"result":{"data":{}}},{"result":{"data":[]}}]')
    if (req.url === "/api/rpc")
      return res
        .writeHead(200, { "content-type": "application/json" })
        .end('{"jsonrpc":"2.0","result":3,"id":1}')
    if (req.url === "/api/soap")
      return res
        .writeHead(200, { "content-type": "text/xml" })
        .end(
          '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><m:GetPriceResponse><m:Price>1.90</m:Price></m:GetPriceResponse></soap:Body></soap:Envelope>',
        )
    if (req.url === "/decoders")
      return res
        .writeHead(200, { "content-type": "text/html" })
        .end(decodersPage)
    if (req.url === "/api/sse")
      return res
        .writeHead(200, { "content-type": "text/event-stream" })
        .end(
          'data: {"n":1}\n\nevent: ping\ndata: {"n":2}\n\ndata: line one\ndata: line two\n\n',
        )
    if (req.url === "/api/ndjson")
      return res
        .writeHead(200, { "content-type": "application/x-ndjson" })
        .end('{"n":1}\n{"n":2}\n{"n":3}\n')
    if (req.url === "/v1/chat/completions")
      return res
        .writeHead(200, { "content-type": "text/event-stream" })
        .end(chatStream)
    if (req.url === "/streams")
      return res
        .writeHead(200, { "content-type": "text/html" })
        .end(streamsPage)
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
  // Echoes every frame back, binary frames as binary.
  new WebSocketServer({ server }).on("connection", (ws) =>
    ws.on("message", (data, isBinary) => ws.send(data, { binary: isBinary })),
  )
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
    send<T>(method: string, params: object = {}): Promise<T> {
      const id = ++nextId
      ws.send(JSON.stringify({ id, method, params }))
      return new Promise((done) =>
        pending.set(id, (msg) => done(msg.result as T)),
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
