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
  if (mime === "multipart/mixed")
    return mixedParts(mimeType.match(/boundary="?([^";]+)"?/i)?.[1])
}

export function parseStream(
  mimeType: string,
  text: string,
): StreamEvent[] | undefined {
  const parser = streamParser(mimeType)
  return parser && [...parser.push(text), ...parser.end()]
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

function lineParser(
  feed: (lines: string[]) => StreamEvent[],
  flush: () => StreamEvent[] = () => [],
): StreamParser {
  const split = lines()
  return {
    push: (chunk) => feed(split.push(chunk)),
    end: () => [...feed(split.end()), ...flush()],
  }
}

// WHATWG event-stream parsing, except a trailing event without a blank line is
// kept: a finished body may be cut off mid-event.
function eventStream(): StreamParser {
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

  return lineParser(feed, () => {
    const out: StreamEvent[] = []
    dispatch(out)
    return out
  })
}

function jsonLines(): StreamParser {
  return lineParser((all) =>
    all.filter((line) => line.trim()).map((text) => ({ text })),
  )
}

// One event per part body; part headers are dropped. Without a boundary
// parameter, the first "--" line is taken as the delimiter.
function mixedParts(boundary: string | undefined): StreamParser {
  let delimiter = boundary && `--${boundary}`
  let state: "preamble" | "headers" | "body" | "done" = "preamble"
  let body: string[] = []

  const emit = (out: StreamEvent[]) => {
    if (state === "body") out.push({ text: body.join("\n") })
    body = []
  }

  const feed = (all: string[]) => {
    const out: StreamEvent[] = []
    for (const line of all) {
      if (state === "done") break
      const trimmed = line.trimEnd()
      if (!delimiter && trimmed.startsWith("--")) delimiter = trimmed
      if (trimmed === `${delimiter}--`) {
        emit(out)
        state = "done"
      } else if (trimmed === delimiter) {
        emit(out)
        state = "headers"
      } else if (state === "headers") {
        if (line === "") state = "body"
      } else if (state === "body") body.push(line)
    }
    return out
  }

  return lineParser(feed, () => {
    const out: StreamEvent[] = []
    emit(out)
    return out
  })
}
