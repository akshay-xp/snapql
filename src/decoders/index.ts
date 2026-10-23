import { form } from "./form"
import { graphql } from "./graphql"
import { graphqlWs } from "./graphql-ws"
import { json } from "./json"
import { jsonrpc } from "./jsonrpc"
import { llm } from "./llm"
import { multipart } from "./multipart"
import { socketio } from "./socketio"
import { ndjson, sse } from "./sse"
import { trpc } from "./trpc"
import type { Decoder } from "./types"
import { websocket } from "./websocket"
import { soap, xml } from "./xml"

// Most specific first; json is the catch-all and stays last.
export const decoders: Decoder[] = [
  llm,
  graphql,
  jsonrpc,
  trpc,
  soap,
  xml,
  multipart,
  form,
  socketio,
  graphqlWs,
  websocket,
  sse,
  ndjson,
  json,
]
