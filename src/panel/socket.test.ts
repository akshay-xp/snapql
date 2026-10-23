import { describe, expect, it } from "vitest"
import type { Message } from "../capture/entry"
import { socketRows } from "./socket"

const msg = (dir: "in" | "out"): Message => ({ dir, time: 0, text: "" })

describe("socketRows", () => {
  it("lists protocol, frame counts and how the socket closed", () => {
    expect(
      socketRows({
        socket: { protocol: "chat", closeCode: 1000, closeReason: "bye" },
        messages: [msg("out"), msg("in"), msg("out"), msg("in"), msg("in")],
      }),
    ).toEqual([
      { name: "protocol", value: "chat" },
      { name: "frames sent", value: "2" },
      { name: "frames received", value: "3" },
      { name: "close code", value: "1000" },
      { name: "close reason", value: "bye" },
    ])
  })

  it("says none for no protocol and leaves out what isn't known", () => {
    expect(socketRows({ socket: { protocol: "" }, messages: [] })).toEqual([
      { name: "protocol", value: "none" },
      { name: "frames sent", value: "0" },
      { name: "frames received", value: "0" },
    ])
    expect(
      socketRows({
        socket: { protocol: "", closeCode: 1006, closeReason: "" },
        messages: [],
      }).at(-1),
    ).toEqual({ name: "close code", value: "1006" })
  })
})
