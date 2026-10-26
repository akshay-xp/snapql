# SnapQL

Human-readable network traffic in DevTools: GraphQL, REST, gRPC-web, protobuf, WebSocket, SSE and LLM streams, decoded.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/bopfjlgmfhmpnceeknaddfgeanchkbmm?label=Chrome%20Web%20Store&logo=googlechrome&color=blue)](https://chrome.google.com/webstore/detail/bopfjlgmfhmpnceeknaddfgeanchkbmm)
![Made with Solid](https://img.shields.io/badge/Made%20with-Solid-2C4F7C?logo=solid&logoColor=white)
![Built with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Styled%20with-TailwindCSS-38B2AC?logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/Code-TypeScript-3178C6?logo=typescript&logoColor=white)
![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)

SnapQL adds a tab to Chrome DevTools that lists the page's traffic by what it means: GraphQL operations by name, gRPC calls by method, WebSockets by their messages, LLM streams by their reassembled reply. Pick a request and read its payload and response decoded, instead of raw bytes and escaped JSON.

![A GraphQL operation with its query and variables decoded](store/screenshots/1-graphql.png)

|                                                                                          |                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ![gRPC-web response with named fields](store/screenshots/2-grpc.png)                     | ![WebSocket chat messages](store/screenshots/3-websocket.png)            |
| gRPC-web decoded with field names from your `.proto` files                               | WebSocket frames, each decoded on its own                                |
| ![LLM stream reassembled into a reply and tool call](store/screenshots/4-llm-stream.png) | ![Searching request and response bodies](store/screenshots/5-search.png) |
| LLM streams put back together: reply, tool calls, usage                                  | Search inside request and response bodies                                |

---

### What it decodes

- **GraphQL**: operation names and types, variables, batching, persisted queries, file uploads, `@defer` and error paths
- **REST and JSON**, form data and multipart uploads
- **XML and SOAP**, **JSON-RPC** and **tRPC**
- **gRPC-web and protobuf**, readable without a schema, with field names once you add your `.proto` files
- **MessagePack** and **CBOR**
- **WebSocket**, **Socket.IO** and **graphql-ws** messages
- **Server-sent events** and **NDJSON** streams
- **LLM streams** (OpenAI and Anthropic APIs): reply, thinking, tool calls and token usage
- **JWTs** in headers and cookies, images and fonts as previews

### Find the request you want

- Search request names, URLs and, optionally, bodies; jump between matches
- Filter by protocol and status
- Save filters as workspaces; hide preflights, cached responses, service worker copies and static assets
- Copy any request as cURL or fetch
- Export to HAR with tokens, cookies and passwords redacted
- Follows the DevTools light or dark theme

### Privacy

SnapQL needs no permissions and runs only while DevTools is open. It collects nothing and sends nothing anywhere.

---

### Install

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/bopfjlgmfhmpnceeknaddfgeanchkbmm), then open DevTools and pick the **SnapQL** tab.

Firefox builds work when loaded unpacked (below) but are not published yet.

### Development

Requires Node 22+ and pnpm 10+.

```sh
pnpm install
pnpm build        # dist/chrome and dist/firefox
```

Load the build:
- **Chrome:** open `chrome://extensions`, enable Developer mode, Load unpacked, pick `dist/chrome`
- **Firefox:** open `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, pick `dist/firefox/manifest.json`

Checks:

```sh
pnpm lint         # Biome
pnpm typecheck
pnpm test         # unit tests
pnpm e2e          # the panel in headless Chromium DevTools
pnpm screenshots  # retakes the store screenshots in store/screenshots
```

Releasing is described in [docs/build.md](docs/build.md); how the pieces fit together starts at [docs/overview.md](docs/overview.md).

---

### Contributing

Contributions are welcome. If you have a format to support, a bug report or a fix, [open an issue](https://github.com/akshay-xp/snapql/issues) or submit a pull request.

---

### License

Licensed under the **GNU General Public License v3.0**.
See [LICENSE](LICENSE) for details.
