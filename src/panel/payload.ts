import type { NameValue } from "../capture/entry"
import { baseMime } from "../decoders/text"
import type { RequestView } from "../decoders/types"
import { formatBody } from "./body"

export type Payload = { form: NameValue[] } | { text: string; notes: string[] }

export function requestPayload(
  body: RequestView["requestBody"],
): Payload | undefined {
  if (!body?.text) return
  if (baseMime(body.mimeType) === "application/x-www-form-urlencoded")
    return {
      form: [...new URLSearchParams(body.text)].map(([name, value]) => ({
        name,
        value,
      })),
    }
  // No view: image and font previews read the response's mime type.
  const { text, notes } = formatBody(
    { content: body.text, encoding: "" },
    { mimeType: body.mimeType },
  )
  return { text, notes }
}
