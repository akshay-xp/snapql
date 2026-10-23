import { baseMime } from "./text"

export type StreamEvent = { text: string; event?: string; id?: string }

export type StreamParser = {
  push(chunk: string): StreamEvent[]
  end(): StreamEvent[]
}

export function streamParser(mimeType: string): StreamParser | undefined {
  const mime = baseMime(mimeType)
  if (mime === "text/event-stream") return eventStream()
  if (mime === "application/x-ndjson" || mime === "application/jsonl")
    return jsonLines()
}

// Splits on CRLF, LF or CR. A chunk-final CR is held back: the next chunk may
// start with its LF.
function lines() {
  let buffer = ""
  return {
    push(chunk: string): string[] {
      buffer += chunk
      const out: string[] = []
      let start = 0
      for (let i = 0; i < buffer.length; i++) {
        const c = buffer[i]
        if (c !== "\n" && c !== "\r") continue
        if (c === "\r" && i === buffer.length - 1) break
        out.push(buffer.slice(start, i))
        if (c === "\r" && buffer[i + 1] === "\n") i++
        start = i + 1
      }
      buffer = buffer.slice(start)
      return out
    },
    end(): string[] {
      const rest = buffer.replace(/\r$/, "")
      buffer = ""
      return rest ? [rest] : []
    },
  }
}

// WHATWG event-stream parsing, except a trailing event without a blank line is
// kept: a finished body may be cut off mid-event.
function eventStream(): StreamParser {
  const split = lines()
  let data: string[] = []
  let event: string | undefined
  let id: string | undefined

  const dispatch = (out: StreamEvent[]) => {
    if (data.length)
      out.push({
        text: data.join("\n"),
        ...(event !== undefined && { event }),
        ...(id !== undefined && { id }),
      })
    data = []
    event = undefined
    id = undefined
  }

  const feed = (all: string[]) => {
    const out: StreamEvent[] = []
    for (const line of all) {
      if (line === "") {
        dispatch(out)
        continue
      }
      if (line.startsWith(":")) continue
      const colon = line.indexOf(":")
      const field = colon === -1 ? line : line.slice(0, colon)
      let value = colon === -1 ? "" : line.slice(colon + 1)
      if (value.startsWith(" ")) value = value.slice(1)
      if (field === "data") data.push(value)
      else if (field === "event") event = value
      else if (field === "id") id = value
    }
    return out
  }

  return {
    push: (chunk) => feed(split.push(chunk)),
    end() {
      const out = feed(split.end())
      dispatch(out)
      return out
    },
  }
}

function jsonLines(): StreamParser {
  const split = lines()
  const events = (all: string[]) =>
    all.filter((line) => line.trim()).map((text) => ({ text }))
  return {
    push: (chunk) => events(split.push(chunk)),
    end: () => events(split.end()),
  }
}
