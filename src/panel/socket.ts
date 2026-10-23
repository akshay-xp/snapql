import type { Entry, NameValue } from "../capture/entry"

export function socketRows(
  entry: Pick<Entry, "socket" | "messages">,
): NameValue[] {
  const { protocol = "", closeCode, closeReason } = entry.socket ?? {}
  const sent = entry.messages?.filter((m) => m.dir === "out").length ?? 0
  const received = (entry.messages?.length ?? 0) - sent
  return [
    { name: "protocol", value: protocol || "none" },
    { name: "frames sent", value: String(sent) },
    { name: "frames received", value: String(received) },
    ...(closeCode === undefined
      ? []
      : [{ name: "close code", value: String(closeCode) }]),
    ...(closeReason ? [{ name: "close reason", value: closeReason }] : []),
  ]
}

// 1000 is a normal close; 1005 means the closer gave no code.
export const cleanClose = (code: number) => code === 1000 || code === 1005
