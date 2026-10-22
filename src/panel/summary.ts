import type { NameValue } from "../capture/entry"

export type Section =
  | { name: string; text: string }
  | { name: string; json: unknown }
  | { name: string; rows: NameValue[] }

const section = (name: string, value: unknown): Section =>
  typeof value === "string" ? { name, text: value } : { name, json: value }

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
    return [section("data", data)]
  }
  return Object.entries(data).map(([name, value]) =>
    isNameValueList(value) ? { name, rows: value } : section(name, value),
  )
}
