# Decoders

Turn a request into a protocol `kind`, a `title` and an optional `detail` for the panel row. Pure TypeScript in `src/decoders/`: no `chrome.*`, no Solid.

## Contract (`src/decoders/types.ts`)

- `RequestView`: `method`, `url`, `status`, `mimeType`, `requestBody?: { mimeType, text }`. `mimeType` is the response content type: metadata known at capture, so decoders may use it; response bodies are never read while decoding.
- `Decoder`: `{ kind, decode(req): Decoded | undefined }`. One call covers detect, decode, summarize, so the body is parsed once.
- `Decoded`: `{ title, detail?, data }`. `title` names the request (operation, method, path, element); `detail` qualifies it (operation type, method, counts). Kept apart so the panel never parses text. `data` is the parsed request (decoder-specific).
- `BodyView`: `{ content, encoding }` (`encoding` `""` or `"base64"`), the shape of capture's `Body`, so decoders don't import capture.
- `decodeResponse?(body, decoded)`: optional; `DecodedResponse` (`{ summary, data }`, e.g. `2 errors`) or `undefined` from the raw response `BodyView` and the stored `DecodeResult`. Never run at capture: the panel calls it lazily (Response group in Summary, see `docs/panel.md`), so response bodies still load only on demand. Bodies over `BODY_LIMIT` (1 MB of content) are not decoded; a failed body fetch shows no Response group.
- `decodeMessage?(frame, frames)`: optional; titles one socket frame (`FrameView`: `{ dir, text, bytes? }`, which `Message` satisfies) as a `Decoded`, or `undefined` to fall back to the preview. `frames` is the entry's whole list, for protocols whose frames refer to earlier ones. Never run at capture: the panel calls it per rendered Messages row (and for the selected frame).
- `DecodeResult`: `Decoded & { kind }`, stored on `Entry.decoded`.
- `RequestView.protocols?`: WebSockets only, the protocols requested at creation (from the probe), so socket decoders run at capture like the rest.
- No headers or query params in `RequestView`: GET params come from `url`. Add when a decoder needs them.

## Bytes (`src/decoders/bytes.ts`)

- `bytes(body)`: exact `Uint8Array` (base64 decoded; text UTF-8 encoded). `text(body)`: base64 read as UTF-8 (invalid sequences U+FFFD), text as is. Text decoders call `text(body)` first.
- `requestBytes(text)`: request bytes rebuilt from Chrome's HAR `postData.text`, as `Uint8Array[]` candidates. Chrome gives valid UTF-8 bodies decoded and anything else as one code unit per byte (Latin-1), pinned in e2e (`/binary`). Text with a code unit above U+00FF, or pure ASCII: one candidate, the UTF-8 encoding. Otherwise the UTF-8 encoding, plus the Latin-1 bytes when those aren't valid UTF-8 (valid ones Chrome would have decoded). The text alone can't tell these apart (`é\x01` is `C3 A9 01` or `E9 01`; e2e saw the former), so binary decoders keep the first candidate that parses fully. Firefox: unverified.

## Registry (`src/decoders/registry.ts`)

- `decodeRequest(req, decoders)`: tries decoders in order; first non-`undefined` wins, tagged with its `kind`.
- A decoder that throws counts as no match, so a bad decoder never drops a request.
- Runs once per entry, in `startCapture`; the UI only reads `entry.decoded`.
- `DECODE_LIMIT` (1024 * 1024 chars): a request body over it is not decoded at all; the row stays raw so one huge upload can't stall capture.
- `decoderFor(kind, decoders)`: finds a stored entry's decoder by `kind` (for lazy response decoding).
- Order lives in `src/decoders/index.ts` (`decoders`), most specific first: `llm`, `graphql`, `jsonrpc`, `trpc`, `soap`, `xml`, `multipart`, `form`, `socketio`, `graphql-ws`, `websocket`, `sse`, `ndjson`, `json` (catch-all, last).

## Adding a decoder

1. `src/decoders/<protocol>.ts` exporting a `Decoder`, with `<protocol>.test.ts` beside it.
2. Add it to the `decoders` array in `src/decoders/index.ts`.

No capture, store, or UI change.

## Streams (`src/decoders/stream.ts`, `src/decoders/sse.ts`)

- `streamParser(mimeType)`: `{ push(chunk), end() }`, each returning `StreamEvent[]` (`{ text, event?, id? }`), or `undefined` when the base mime isn't a stream mime. Incremental, so live chunks and finished bodies give the same events however the text is split (tested at every split index). `parseStream(mimeType, text)`: one-shot, `undefined` without a parser. Callers add `dir`/`time` to make a `Message`.
- Lines split on CRLF, LF or CR; a chunk-final CR is held back in case its LF starts the next chunk.
- `text/event-stream`: WHATWG rules. `data:` lines joined with `\n`; `event:`, `id:` per event (not carried to later events); `:` comments and `retry:` ignored; one leading space after `:` stripped; a block without `data` not dispatched. Deviation: a trailing event without a blank line is kept, since a finished body may be cut off mid-event.
- `application/x-ndjson`, `application/jsonl`: one event per non-empty line.
- `multipart/mixed` (GraphQL `@defer`/`@stream`): one event per part body, part headers dropped. Boundary from the mime's `boundary` param, else the first line starting `--` is the delimiter; `--<b>--` ends the stream (later text ignored).
- Decoders `sse` (`text/event-stream`) and `ndjson` (`application/x-ndjson`, `application/jsonl`) match on response mime only: title = path, detail = method, no `data`. Placed just before `json`, so a stream whose request another decoder claims (GraphQL over SSE, LLM) keeps that kind, and a JSON POST to an SSE endpoint is `sse`, not `json`. `multipart/mixed` gets no kind of its own.

## WebSocket (`src/decoders/websocket.ts`)

- `socketDecoder(kind, match)`: the shared socket `decode` (method `WS` and `match(req)`; title path, detail requested protocols). `websocket` is `socketDecoder("websocket", () => true)`, last of the three.

- Kind `websocket`. Matches method `WS` (only probe socket entries have it). Title = URL path, detail = requested protocols joined `, ` (absent when none). No `data`.

## Socket.IO (`src/decoders/socketio.ts`)

- Kind `socketio`: a `WS` entry whose URL path contains `/socket.io/`.
- `decodeMessage`: binary frames (attachments) are left alone. Engine.IO type is the first char: `0` open (data = handshake JSON), `1` close, `2` ping, `3` pong (text after it, e.g. `probe`, as detail), `5` upgrade, `6` noop, `4` message carrying a Socket.IO packet.
- Packet grammar `<type>[<attachments>-][/<namespace>,][<ack id>][<JSON>]`: `0` connect, `1` disconnect, `4` connect_error (data = payload), `2` event and `5` binary event (title = event name, data `{ args, ack? }`), `3` ack and `6` binary ack (title `ack <id>`, data `{ args }`). Detail: a namespace other than `/`, and `binary`, joined `, `.

## graphql-ws (`src/decoders/graphql-ws.ts`)

- Kind `graphql-ws`: a `WS` entry requesting `graphql-transport-ws` (graphql-ws library) or `graphql-ws` (legacy subscriptions-transport-ws).
- `decodeMessage` on JSON frames with a string `type`: control types (`connection_init`, `connection_ack`, `connection_error`, `connection_terminate`, `ping`, `pong`, `ka`) titled by type, data = `payload`. `subscribe`/`start`: title = operation name via `requestLabel(payload)` (exported from `graphql.ts`, so names match HTTP GraphQL rows, APQ included), `anonymous` without one; detail = type. `next`/`data`/`error`/`complete`/`stop`: title = the operation of the last `subscribe`/`start` in `frames` with the same `id` (the id itself when none), detail = type. Other types: `undefined`.

## LLM (`src/decoders/llm.ts`)

- Kind `llm`. Matches a JSON request body that is a plain object with `stream: true`, a string `model`, and a `messages` array or an `input` field. Host is ignored (proxies, gateways, self-hosted). Title = `model`, detail `stream`, `data` = the body. First in order, so an LLM body with a stray `query` field isn't GraphQL. Non-streaming requests don't match.
- `reassemble(events: StreamEvent[])`: `Reassembled` (`{ text, thinking?, toolCalls: { id?, name, arguments }[], stopReason?, usage? }`) or `undefined`. Each event's text is JSON-parsed (failures, e.g. `[DONE]`, skipped); the first payload of a known format picks the folder:
  - OpenAI Chat Completions (`choices` array): `choices[0].delta.content` concatenated; `delta.tool_calls` merged by `index` (`id`, `function.name`, `function.arguments` appended); `finish_reason`; `usage` (final `choices: []` chunk).
  - OpenAI Responses (`type` starts `response.`): `response.output_text.delta`; a `function_call` item from `response.output_item.added` (`call_id`, `name`) keyed by `output_index`, filled by `response.function_call_arguments.delta`; `response.completed`/`response.incomplete` give `status` (as stop reason) and `usage`.
  - Anthropic Messages (`message_start` or `content_block_*`): blocks keyed by `index`; `tool_use` starts a call (`id`, `name`); deltas `text_delta`, `thinking_delta`, `input_json_delta.partial_json`; `message_delta` gives `stop_reason`; usage = `message_start` usage overlaid by `message_delta` usage.
- `decodeResponse(text)`: `reassemble(parseStream("text/event-stream", text))`. Summary `stop reason`, or `incomplete` when the stream has none. `data` sections, in order: `reply` (text), `thinking` (when present), `tool <name>` per call (`{ id?, arguments }`, arguments parsed when valid JSON, else the raw string; repeated names get ` 2`, ` 3`), `usage` rows (`stop reason` first, then each usage key; non-strings JSON-encoded; omitted when empty). Rendered by Summary's Response group like any decoder, so no LLM-specific UI.
- Not handled: non-streaming replies, other formats (Gemini, ...).

## JSON-RPC (`src/decoders/jsonrpc.ts`)

- Kind `jsonrpc`. A call is a JSON object with `jsonrpc: "2.0"` (other versions don't match) and a string `method`.
- Single call: title = method (`sum`), no detail; `data` `{ method, params }`.
- Batch: non-empty array where every item is a call (one bad item means no match). Title = methods joined `, `, detail `<n> calls`; `data` `{ calls: NameValue[] }`, name = method, value = params JSON (`""` when absent).

## tRPC (`src/decoders/trpc.ts`)

- Kind `trpc`. Matches a URL path with a `trpc` segment followed by a non-empty procedure segment (`/api/trpc/user.byId`).
- Procedures: that segment, URL-decoded, split on `,` (so `%2C` works too). Title: procedures joined by `, `; detail `<n> procedures` only when more than one.
- Input: POST body, else the `input` URL param, parsed as JSON. With `batch=1`, procedure `i` takes `input["<i>"]`; otherwise the whole input.
- `data`: `{ procedures: NameValue[] }`, name = procedure, value = input JSON; `""` when missing or unparseable.
- Before `json`, since tRPC responses are JSON.

## XML and SOAP (`src/decoders/xml.ts`)

- Candidate: request body whose base mime contains `xml`, or whose text starts with `<` (after whitespace). No element found means no match.
- Hand-written regex tokenizer (CDATA, comments, `<?...?>`, `<!...>`, tags, text), no `DOMParser`: decoders run in Vitest without a browser. Names are local names (prefix before `:` stripped).
- `soap`: root `Envelope` (SOAP 1.1 or 1.2, any prefix); title = first element after `Body` (`Header` skipped), e.g. `GetPrice`. Empty `Body` means no match, so `xml` takes it.
- `xml`: title = root local name (`ns:Order` gives `Order`); prolog, comments and DOCTYPE skipped.
- `data`: `{ xml: prettyXml(text) }`.
- `prettyXml(text)`: two-space indent per depth; whitespace-only text dropped; an element whose only child is text or CDATA stays on one line, verbatim; tags, comments, PIs and CDATA never split. Unbalanced input (e.g. HTML void tags) or no elements: returned unchanged. Also used by the Body tab.

## Multipart (`src/decoders/multipart.ts`)

- Kind `multipart`. Matches a request body whose base mime is `multipart/form-data` with a `boundary` param (quotes allowed); no boundary means no match.
- Shared with GraphQL uploads: `multipartParts(body)` (mime + boundary check, then parse; `undefined` if not multipart) and `fileRows(parts)` (file parts as rows).
- `parseMultipart(text, boundary)` returns `Part[]` (`{ name, filename?, type?, content }`): CRLF or LF, headers case-insensitive, parts without a `name` skipped.
- Parts with a `filename` are files, the rest fields. Title = URL path; detail joins the non-zero counts: `2 fields`, `1 file`, `2 fields, 1 file`.
- `data`: `{ fields: NameValue[], files: NameValue[] }`, rendered as rows. File value `<filename> (<type>, <n> bytes)`; type defaults to `application/octet-stream`; size is UTF-8 bytes of the captured content.
- Empty file content shows `size unknown`: browsers may omit file contents from the captured body, so a truly empty file looks the same.

## Form (`src/decoders/form.ts`)

- Kind `form`. Matches a request body whose base mime is `application/x-www-form-urlencoded`.
- Title: URL path; detail: field count, `1 field` / `<n> fields`. `data`: `{ fields: NameValue[] }`, decoded with `URLSearchParams` (`%XX` and `+`), rendered as rows (see `docs/panel.md`).
- Shared helpers in `src/decoders/text.ts`: `baseMime(mime)` (before `;`, lowercased), `count(n, word)`. Used by form and multipart.

## JSON (`src/decoders/json.ts`)

- Kind `json`, the catch-all for REST/JSON calls; last in order so specific JSON protocols win.
- Matches when the request body parses as JSON, or the response `mimeType` is JSON (base type before `;` ends in `/json` or `+json`).
- Title: URL path (`/api/users/1`); detail: method. `data`: parsed request body, or `undefined` when there is none.
- `parseJson(text)`: shared helper (also used by GraphQL), `undefined` on failure.

## GraphQL (`src/decoders/graphql.ts`)

- Kind `graphql`. Input: JSON request body, or `query`/`operationName` URL params when there is no body.
- Matches a plain object with a string `query`, or an APQ request (below), or a batch of them. Non-JSON bodies don't match.
- Title = operation name, detail = operation type: `GetUser` / `query`, `AddTodo` / `mutation`. Anonymous: title `anonymous`. Shorthand `{ ... }`: `anonymous` / `query`.
- APQ (Automatic Persisted Queries): no `query` text but a string `extensions.persistedQuery.sha256Hash`, in the POST body or a JSON-encoded `extensions` GET param. Title = `operationName`, or the first 8 hash chars without one; detail `persisted`. When query text is present it takes precedence. An unparseable `extensions` param means no match.
- Multiple operations: the one named by `operationName`, else the first. `fragment` definitions are skipped.
- Hand-written tokenizer (no `graphql` dep): tracks brace depth; strings, block strings, and `#` comments are skipped so their contents never count.
- `data` is the parsed body (or the URL params object).
- Batch: non-empty array body where every item is an operation or APQ (one bad item means no match). Title = op titles joined `, `; detail `<n> ops` (`1 op`). `data`: `{ operations: NameValue[] }`, name = `<detail> <title>` (`query A`, `persisted GetUser`), value = query text (APQ: the hash); plus `variables: NameValue[]` for ops that have variables (value = JSON), omitted when none do.
- Uploads (GraphQL multipart request spec): a `multipart/form-data` body with a non-file `operations` field is decoded from that JSON (single or batch, as above); `data` gains `files: NameValue[]` from the file parts. Without a GraphQL `operations` field it doesn't match, so `multipart` takes it.
- `decodeResponse`: JSON object with `data` or `errors` (else `undefined`). `summary` `<n> errors` / `1 error` / `no errors`. `data`: `errors: NameValue[]` (name = `path` joined with `.`, or `(root)`; value = message) when non-empty, plus `data` when present.
- Incremental responses (`@defer`/`@stream`, multipart/mixed): text starting with `--`, split with `parseStream("multipart/mixed", text)` (boundary from the body); each part's text parsed as JSON. Merge: clone of the first part's `data`; each `incremental[]` item's `data` assigned onto the object at its `path`, `items` appended to the list at `path` minus its last segment. Errors collected from every part and item. Same output shape plus `parts: <n>`. Only the `incremental[]` format; the older top-level `path`/`data` and newer `pending`/`id` formats are not handled.

## Key files

- `src/decoders/types.ts`, `src/decoders/registry.ts`, `src/decoders/index.ts`
- `src/decoders/graphql.ts`, `src/decoders/jsonrpc.ts`, `src/decoders/trpc.ts`, `src/decoders/xml.ts`, `src/decoders/multipart.ts`, `src/decoders/form.ts`, `src/decoders/json.ts`, `src/decoders/stream.ts`, `src/decoders/sse.ts`, `src/decoders/llm.ts`, `src/decoders/websocket.ts`, `src/decoders/socketio.ts`, `src/decoders/graphql-ws.ts` (+ `.test.ts`), `src/decoders/text.ts`, `src/decoders/bytes.ts`, `src/decoders/registry.test.ts`
- E2E: `/decoders` page in `e2e/harness.ts`, one request per M3 decoder, asserted in `e2e/panel.test.ts`.

## Related

- `docs/capture.md`: where decoding runs.
- `docs/overview.md`
