SnapQL turns the network traffic in DevTools into something you can read. GraphQL operations show their names, REST calls their paths, gRPC-web and protobuf their messages, WebSockets their frames and LLM streams their reassembled reply, all in one list next to the Network tab.

WHAT IT DECODES

• GraphQL: operation names and types, variables, batching, persisted queries, file uploads, @defer and error paths
• REST and JSON, form data and multipart uploads
• XML and SOAP, JSON-RPC and tRPC
• gRPC-web and protobuf, readable without a schema, with field names once you add your .proto files
• MessagePack and CBOR
• WebSocket, Socket.IO and graphql-ws messages
• Server-sent events and NDJSON streams
• LLM streams (OpenAI and Anthropic APIs), with the reply, thinking, tool calls and token usage put back together
• JWTs in headers and cookies, images and fonts as previews

FIND THE REQUEST YOU WANT

• Search request names, URLs and bodies
• Filter by protocol and status
• Save filters as workspaces, and hide preflights, cached responses, service worker copies and static assets
• Copy any request as cURL or fetch
• Export to HAR with tokens, cookies and passwords redacted
• Follows the DevTools light or dark theme

PRIVACY

SnapQL needs no permissions and runs only while DevTools is open. It collects nothing and sends nothing anywhere: everything stays in your browser.

SUPPORT

Report issues or request a format at github.com/akshay-xp/snapql/issues
