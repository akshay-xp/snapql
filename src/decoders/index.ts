import { form } from "./form"
import { graphql } from "./graphql"
import { json } from "./json"
import { jsonrpc } from "./jsonrpc"
import { multipart } from "./multipart"
import { trpc } from "./trpc"
import type { Decoder } from "./types"
import { soap, xml } from "./xml"

// Most specific first; json is the catch-all and stays last.
export const decoders: Decoder[] = [
  graphql,
  jsonrpc,
  trpc,
  soap,
  xml,
  multipart,
  form,
  json,
]
