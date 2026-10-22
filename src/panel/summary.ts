export type Section = { name: string; text: string }

const toText = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2)

export function dataSections(data: unknown): Section[] {
  if (data === null || data === undefined) return []
  if (typeof data !== "object" || Array.isArray(data)) {
    return [{ name: "data", text: toText(data) }]
  }
  return Object.entries(data).map(([name, value]) => ({
    name,
    text: toText(value),
  }))
}
