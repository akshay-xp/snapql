# Decoders

Turn a request into a protocol `kind` and a one-line `summary` for the panel row. Pure TypeScript in `src/decoders/`: no `chrome.*`, no Solid.

## Contract (`src/decoders/types.ts`)

- `RequestView`: `method`, `url`, `status`, `requestBody?: { mimeType, text }`. Request side only; response bodies are never read while decoding.
- `Decoder`: `{ kind, decode(req): Decoded | undefined }`. One call covers detect, decode, summarize, so the body is parsed once.
- `Decoded`: `{ summary, data }`; `data` is the parsed request (decoder-specific).
- `DecodeResult`: `Decoded & { kind }`, stored on `Entry.decoded`.
- No headers or query params in `RequestView` yet: no decoder needs them; GET params come from `url`. Add when a decoder does (M3).
- Response decoding is out of M1; planned as an optional lazy `decodeResponse(body)` when M2 adds the detail view.

## Registry (`src/decoders/registry.ts`)

- `decodeRequest(req, decoders)`: tries decoders in order; first non-`undefined` wins, tagged with its `kind`.
- A decoder that throws counts as no match, so a bad decoder never drops a request.
- Runs once per entry, in `startCapture`; the UI only reads `entry.decoded`.
- Order lives in `src/decoders/index.ts` (`decoders`). More specific decoders go first.

## Adding a decoder

1. `src/decoders/<protocol>.ts` exporting a `Decoder`, with `<protocol>.test.ts` beside it.
2. Add it to the `decoders` array in `src/decoders/index.ts`.

No capture, store, or UI change.

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
- `src/decoders/graphql.ts`, `src/decoders/graphql.test.ts`, `src/decoders/registry.test.ts`

## Related

- `docs/capture.md`: where decoding runs.
- `docs/overview.md`
