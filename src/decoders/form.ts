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
    const fields = [...new URLSearchParams(body.text)].map(([name, value]) => ({
      name,
      value,
    }))
    return { summary: count(fields.length, "field"), data: { fields } }
  },
}
