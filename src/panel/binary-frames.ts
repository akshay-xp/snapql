import type { Message } from "../capture/entry"
import { bytes } from "../decoders/bytes"
import { readCbor } from "../decoders/cbor"
import { readMsgpack } from "../decoders/msgpack"
import { readMessage } from "../decoders/protobuf"
import type { Decoded } from "../decoders/types"
import { hexDump } from "./hex-dump"
import { messageText, preview } from "./messages"

export type BinaryFormat = "hex" | "msgpack" | "cbor" | "protobuf"

const READERS = {
  msgpack: readMsgpack,
  cbor: readCbor,
  protobuf: readMessage,
}

// The first protocol naming a binary format wins; negotiated goes first.
export function binaryFormat(protocols: readonly string[]): BinaryFormat {
  for (const p of protocols) {
    if (p.includes("msgpack")) return "msgpack"
    if (p.includes("cbor")) return "cbor"
    if (p.includes("proto")) return "protobuf"
  }
  return "hex"
}

export function decodeBinaryFrame(
  m: Pick<Message, "text" | "bytes"> & { base64: string },
  format: BinaryFormat,
): Decoded {
  const data = bytes({ content: m.base64, encoding: "base64" })
  const title = messageText(m)
  if (format === "hex") return { title, data: hexDump(data) }
  try {
    const value = READERS[format](data)
    return {
      title: preview(JSON.stringify(value) ?? String(value)),
      detail: format,
      data: value,
    }
  } catch (err) {
    return {
      title,
      detail: `invalid ${format}`,
      data: `${(err as Error).message}\n\n${hexDump(data)}`,
    }
  }
}
