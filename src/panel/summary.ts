import type { NameValue } from "../capture/entry"

export type Section =
  | { name: string; text: string }
  | { name: string; rows: NameValue[] }

const toText = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2)

function isNameValueList(value: unknown): value is NameValue[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        typeof item?.name === "string" && typeof item?.value === "string",
    )
  )
}

export function dataSections(data: unknown): Section[] {
  if (data === null || data === undefined) return []
  if (typeof data !== "object" || Array.isArray(data)) {
    return [{ name: "data", text: toText(data) }]
  }
  return Object.entries(data).map(([name, value]) =>
    isNameValueList(value)
      ? { name, rows: value }
      : { name, text: toText(value) },
  )
}
