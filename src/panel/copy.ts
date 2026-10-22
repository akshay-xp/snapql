import type { NameValue } from "../capture/entry"

export const valueText = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2)

export const pairsText = (pairs: NameValue[]) =>
  pairs.map((p) => `${p.name} = ${p.value}`).join("\n")
