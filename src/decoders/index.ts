import { form } from "./form"
import { graphql } from "./graphql"
import { json } from "./json"
import type { Decoder } from "./types"

// Most specific first; json is the catch-all and stays last.
export const decoders: Decoder[] = [graphql, form, json]
