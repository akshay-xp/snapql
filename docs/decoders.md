# Decoders

Turn a request into a protocol `kind` and a one-line `summary` for the panel row. Pure TypeScript in `src/decoders/`: no `chrome.*`, no Solid.

## Contract (`src/decoders/types.ts`)

- `RequestView`: `method`, `url`, `status`, `mimeType`, `requestBody?: { mimeType, text }`. `mimeType` is the response content type: metadata known at capture, so decoders may use it; response bodies are never read while decoding.
- `Decoder`: `{ kind, decode(req): Decoded | undefined }`. One call covers detect, decode, summarize, so the body is parsed once.
- `Decoded`: `{ summary, data }`; `data` is the parsed request (decoder-specific).
- `DecodeResult`: `Decoded & { kind }`, stored on `Entry.decoded`.
- No headers or query params in `RequestView`: GET params come from `url`. Add when a decoder needs them.

## Registry (`src/decoders/registry.ts`)

- `decodeRequest(req, decoders)`: tries decoders in order; first non-`undefined` wins, tagged with its `kind`.
- A decoder that throws counts as no match, so a bad decoder never drops a request.
- Runs once per entry, in `startCapture`; the UI only reads `entry.decoded`.
- `DECODE_LIMIT` (1024 * 1024 chars): a request body over it is not decoded at all; the row stays raw so one huge upload can't stall capture.
- `decoderFor(kind, decoders)`: finds a stored entry's decoder by `kind` (for lazy response decoding).
- Order lives in `src/decoders/index.ts` (`decoders`), most specific first: `graphql`, `form`, `json` (catch-all, last). Later M3 decoders slot in before `form`.

## Adding a decoder

1. `src/decoders/<protocol>.ts` exporting a `Decoder`, with `<protocol>.test.ts` beside it.
2. Add it to the `decoders` array in `src/decoders/index.ts`.

No capture, store, or UI change.

## Form (`src/decoders/form.ts`)

- Kind `form`. Matches a request body whose base mime is `application/x-www-form-urlencoded`.
- Summary: field count, `1 field` / `<n> fields`. `data`: `{ fields: NameValue[] }`, decoded with `URLSearchParams` (`%XX` and `+`), rendered as rows (see `docs/panel.md`).
- Shared helpers in `src/decoders/text.ts`: `baseMime(mime)` (before `;`, lowercased), `count(n, word)`.

## JSON (`src/decoders/json.ts`)

- Kind `json`, the catch-all for REST/JSON calls; last in order so specific JSON protocols win.
- Matches when the request body parses as JSON, or the response `mimeType` is JSON (base type before `;` ends in `/json` or `+json`).
- Summary: URL path (`/api/users/1`). `data`: parsed request body, or `undefined` when there is none.
- `parseJson(text)`: shared helper (also used by GraphQL), `undefined` on failure.

## GraphQL (`src/decoders/graphql.ts`)

- Kind `graphql`. Input: JSON request body, or `query`/`operationName` URL params when there is no body.
- Matches a plain object with a string `query`, or an APQ request (below). Non-JSON bodies and batched arrays don't match (batching is M3).
- Summary `<type> <name>`: `query GetUser`, `mutation AddTodo`, `subscription OnTick`. Anonymous: `<type>`. Shorthand `{ ... }`: `query`.
- APQ (Automatic Persisted Queries): no `query` text but a string `extensions.persistedQuery.sha256Hash`, in the POST body or a JSON-encoded `extensions` GET param. Summary `persisted <operationName>`, or `persisted <first 8 hash chars>` without a name. When query text is present it takes precedence. An unparseable `extensions` param means no match.
- Multiple operations: the one named by `operationName`, else the first. `fragment` definitions are skipped.
- Hand-written tokenizer (no `graphql` dep): tracks brace depth; strings, block strings, and `#` comments are skipped so their contents never count.
- `data` is the parsed body (or the URL params object).

## Key files

- `src/decoders/types.ts`, `src/decoders/registry.ts`, `src/decoders/index.ts`
- `src/decoders/graphql.ts`, `src/decoders/form.ts`, `src/decoders/json.ts` (+ `.test.ts`), `src/decoders/text.ts`, `src/decoders/registry.test.ts`
- E2E: `/decoders` page in `e2e/harness.ts`, one request per M3 decoder, asserted in `e2e/panel.test.ts`.

## Related

- `docs/capture.md`: where decoding runs.
- `docs/overview.md`
