import { baseMime, count } from "./text"
import type { Decoder } from "./types"

export const form: Decoder = {
  kind: "form",
  decode(req) {
    const body = req.requestBody
    if (
      !body ||
      baseMime(body.mimeType) !== "application/x-www-form-urlencoded"
    )
      return
    // No data: the Payload tab shows the fields, so Summary would only repeat them.
    return {
      title: new URL(req.url).pathname,
      detail: count([...new URLSearchParams(body.text)].length, "field"),
      data: undefined,
    }
  },
}
