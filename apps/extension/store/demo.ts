import { createServer, type IncomingMessage, type Server } from "node:http"
import { WebSocketServer } from "ws"

// Demo pages for the store screenshots: a fictional travel app, so the shots
// show realistic traffic without real companies or people.

const page = (script: string) => `<!doctype html>
<link rel="icon" href="data:,">
<title>Wayfare</title>
<script>
${script}
</script>`

const travelPage = page(`
  const gql = (body) =>
    fetch("/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  ;(async () => {
    await fetch("/api/session")
    await gql({
      operationName: "GetTrips",
      query: "query GetTrips { trips(upcoming: true) { id destination departsAt } }",
    })
    await gql({
      operationName: "SearchFlights",
      query: "query SearchFlights($from: String!, $to: String!, $date: Date!, $cabin: Cabin, $passengers: Int) {\\n  flights(from: $from, to: $to, date: $date, cabin: $cabin, passengers: $passengers) {\\n    id\\n    carrier\\n    departsAt\\n    arrivesAt\\n    stops\\n    fare { amount currency }\\n  }\\n}",
      variables: { from: "SFO", to: "JFK", date: "2026-11-14", cabin: "ECONOMY", passengers: 2 },
    })
    await gql([
      { operationName: "GetAirports", query: "query GetAirports($codes: [String!]!) { airports(codes: $codes) { code city } }", variables: { codes: ["SFO", "JFK"] } },
      { operationName: "GetFareRules", query: "query GetFareRules($fare: ID!) { fareRules(fare: $fare) { refundable changeFee } }", variables: { fare: "WF-ECO-SAVER" } },
    ])
    await gql({
      operationName: "GetCurrency",
      variables: { code: "USD" },
      extensions: { persistedQuery: { version: 1, sha256Hash: "9f1c0a7e5b2d4c8e6a3f1b0d9e7c5a3b1f9d7e5c3a1b9f7d5e3c1a9b7f5d3e1c" } },
    })
    await gql({
      operationName: "TripDetails",
      query: "query TripDetails($id: ID!) { trip(id: $id) { id destination hotel { name nights } } }",
      variables: { id: "TR-2841" },
    })
    await gql({
      operationName: "BookSeat",
      query: "mutation BookSeat($flight: ID!, $seat: String!) { bookSeat(flight: $flight, seat: $seat) { confirmation seat } }",
      variables: { flight: "WF-212", seat: "14C" },
    })
    await fetch("/api/newsletter", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "email=traveler%40example.com&topics=deals&topics=alerts",
    })
  })()
`)

const flights = [
  {
    id: "WF-212",
    carrier: "Wayfare Air",
    departsAt: "2026-11-14T07:05:00-08:00",
    arrivesAt: "2026-11-14T15:40:00-05:00",
    stops: 0,
    fare: { amount: 289, currency: "USD" },
  },
  {
    id: "WF-418",
    carrier: "Wayfare Air",
    departsAt: "2026-11-14T11:30:00-08:00",
    arrivesAt: "2026-11-14T20:02:00-05:00",
    stops: 0,
    fare: { amount: 254, currency: "USD" },
  },
  {
    id: "CL-77",
    carrier: "Coastline",
    departsAt: "2026-11-14T13:15:00-08:00",
    arrivesAt: "2026-11-15T00:10:00-05:00",
    stops: 1,
    fare: { amount: 198, currency: "USD" },
  },
]

const answers: Record<string, unknown> = {
  GetTrips: {
    trips: [
      { id: "TR-2841", destination: "New York", departsAt: "2026-11-14" },
      { id: "TR-2907", destination: "Lisbon", departsAt: "2027-01-09" },
    ],
  },
  SearchFlights: { flights },
  GetAirports: {
    airports: [
      { code: "SFO", city: "San Francisco" },
      { code: "JFK", city: "New York" },
    ],
  },
  GetFareRules: { fareRules: { refundable: false, changeFee: 75 } },
  GetCurrency: { currency: { code: "USD", symbol: "$", rate: 1 } },
  TripDetails: {
    trip: {
      id: "TR-2841",
      destination: "New York",
      hotel: { name: "Harbor View Hotel", nights: 4 },
    },
  },
  BookSeat: { bookSeat: { confirmation: "WF8K2Q", seat: "14C" } },
}

// Just enough protobuf to encode the catalog messages below.
const varint = (n: number) => {
  const out: number[] = []
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80)
    n = Math.floor(n / 128)
  }
  out.push(n)
  return out
}
type Field = [number, string | number]
const message = (fields: Field[]): number[] =>
  fields.flatMap(([n, v]) => {
    if (typeof v === "number") return [...varint(n << 3), ...varint(v)]
    const bytes = [...Buffer.from(v)]
    return [...varint((n << 3) | 2), ...varint(bytes.length), ...bytes]
  })
const frame = (flag: number, bytes: number[]) => [
  flag,
  ...[24, 16, 8, 0].map((shift) => (bytes.length >>> shift) & 0xff),
  ...bytes,
]
const trailer = (status: string) =>
  frame(0x80, [...Buffer.from(`grpc-status:${status}\r\n`)])

export const CATALOG_PROTO = `
syntax = "proto3";
package catalog;
enum Availability { AVAILABILITY_UNKNOWN = 0; IN_STOCK = 1; BACKORDER = 2; }
message GetProductRequest { string id = 1; }
message ListProductsRequest { string category = 1; int32 limit = 2; }
message Product {
  string id = 1;
  string name = 2;
  int64 price_cents = 3;
  repeated string tags = 4;
  Availability availability = 5;
}
service ProductService {
  rpc GetProduct(GetProductRequest) returns (Product);
  rpc ListProducts(ListProductsRequest) returns (stream Product);
}
`

const product = (
  id: string,
  name: string,
  cents: number,
  tags: string[],
  availability: number,
) =>
  message([
    [1, id],
    [2, name],
    [3, cents],
    ...tags.map((t): Field => [4, t]),
    [5, availability],
  ])

const grpcReplies: Record<string, number[]> = {
  "/catalog.ProductService/GetProduct": [
    ...frame(
      0,
      product(
        "P-1042",
        "Carry-on Spinner 22in",
        18900,
        ["luggage", "carry-on", "lightweight"],
        1,
      ),
    ),
    ...trailer("0"),
  ],
  "/catalog.ProductService/ListProducts": [
    ...frame(
      0,
      product("P-1042", "Carry-on Spinner 22in", 18900, ["luggage"], 1),
    ),
    ...frame(
      0,
      product("P-2210", "Packing Cubes, set of 4", 3400, ["organizers"], 1),
    ),
    ...frame(0, product("P-3307", "Travel Pillow", 2900, ["comfort"], 2)),
    ...trailer("0"),
  ],
}

const grpcPage = page(`
  const call = (method, bytes) =>
    fetch("/catalog.ProductService/" + method, {
      method: "POST",
      headers: { "content-type": "application/grpc-web+proto", "x-grpc-web": "1" },
      body: new Uint8Array(bytes),
    })
  call("ListProducts", ${JSON.stringify(
    frame(
      0,
      message([
        [1, "travel"],
        [2, 3],
      ]),
    ),
  )})
  call("GetProduct", ${JSON.stringify(frame(0, message([[1, "P-1042"]])))})
`)

// Opened on click, once the panel's probe is in the page to see it.
const chatPage = page(`
  window.start = () => {
    const ws = new WebSocket(location.origin.replace("http", "ws") + "/chat?room=trip-2841")
    const send = (msg) => ws.send(JSON.stringify(msg))
    ws.onopen = async () => {
      send({ type: "join", room: "trip-2841", user: "sam" })
      for (const text of [
        "Landed at JFK, heading to the hotel",
        "Can we push dinner to 8?",
        "Booked the 8:15 table at Harbor View",
      ]) {
        await new Promise((r) => setTimeout(r, 40))
        send({ type: "message", room: "trip-2841", text })
      }
    }
  }
`)

const assistantPage = page(`
  fetch("/api/session")
  fetch("/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "demo-chat-1",
      stream: true,
      stream_options: { include_usage: true },
      tools: [{ type: "function", function: { name: "search_flights" } }],
      messages: [
        { role: "system", content: "You are Wayfare's trip assistant." },
        { role: "user", content: "Find me a nonstop from SFO to JFK on Nov 14, morning if possible." },
      ],
    }),
  })
`)

const chunk = (delta: object, finish_reason: string | null = null) =>
  JSON.stringify({
    id: "chatcmpl-demo",
    object: "chat.completion.chunk",
    model: "demo-chat-1",
    choices: [{ index: 0, delta, finish_reason }],
  })

const replyText =
  "Happy to help. Nonstops from SFO to JFK on Nov 14 leave from 7:05 AM, so a morning flight works. Let me check fares for two passengers."
const toolArgs = JSON.stringify({
  from: "SFO",
  to: "JFK",
  date: "2026-11-14",
  nonstop: true,
  departs_before: "12:00",
})

const chatStream = [
  chunk({ role: "assistant", content: "" }),
  ...replyText.split(/(?<= )/).map((word) => chunk({ content: word })),
  chunk({
    tool_calls: [
      {
        index: 0,
        id: "call_7Qd2",
        type: "function",
        function: { name: "search_flights", arguments: "" },
      },
    ],
  }),
  ...[toolArgs.slice(0, 30), toolArgs.slice(30)].map((part) =>
    chunk({ tool_calls: [{ index: 0, function: { arguments: part } }] }),
  ),
  chunk({}, "tool_calls"),
  JSON.stringify({
    id: "chatcmpl-demo",
    object: "chat.completion.chunk",
    choices: [],
    usage: { prompt_tokens: 412, completion_tokens: 68, total_tokens: 480 },
  }),
  "[DONE]",
]
  .map((data) => `data: ${data}\n\n`)
  .join("")

const replies: Record<string, string> = {
  "Can we push dinner to 8?": "Sure, see you at 8",
  "Booked the 8:15 table at Harbor View": "Perfect, thanks!",
}

const json = (res: import("node:http").ServerResponse, body: unknown) =>
  res
    .writeHead(200, { "content-type": "application/json" })
    .end(JSON.stringify(body))

const readBody = (req: IncomingMessage) =>
  new Promise<string>((done) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => done(body))
  })

const answer = (op: { operationName?: string }) => ({
  data: answers[op.operationName ?? ""] ?? null,
})

export function demoServer(): Server {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://demo").pathname
    if (path === "/")
      return res.writeHead(200, { "content-type": "text/html" }).end(travelPage)
    if (path === "/graphql") {
      const body = JSON.parse(await readBody(req))
      return json(res, Array.isArray(body) ? body.map(answer) : answer(body))
    }
    if (path === "/assistant")
      return res
        .writeHead(200, { "content-type": "text/html" })
        .end(assistantPage)
    if (path === "/v1/chat/completions")
      return res
        .writeHead(200, { "content-type": "text/event-stream" })
        .end(chatStream)
    if (path === "/chat")
      return res.writeHead(200, { "content-type": "text/html" }).end(chatPage)
    if (path === "/grpc")
      return res.writeHead(200, { "content-type": "text/html" }).end(grpcPage)
    const grpc = grpcReplies[path]
    if (grpc)
      return res
        .writeHead(200, { "content-type": "application/grpc-web+proto" })
        .end(Buffer.from(grpc))
    if (path === "/api/session")
      return json(res, {
        user: { id: "u_5f2a", name: "Sam Rivera", tier: "gold" },
        locale: "en-US",
      })
    if (path === "/api/newsletter") return res.writeHead(204).end()
    res.writeHead(404).end()
  })
  let acks = 3120
  new WebSocketServer({ server }).on("connection", (ws) =>
    ws.on("message", (data) => {
      const msg = JSON.parse(String(data))
      const send = (reply: object) => ws.send(JSON.stringify(reply))
      if (msg.type === "join")
        return send({
          type: "presence",
          room: msg.room,
          online: ["sam", "jo", "priya"],
        })
      send({ type: "ack", id: `m_${acks++}` })
      const reply = replies[msg.text]
      if (reply)
        send({ type: "message", room: msg.room, user: "jo", text: reply })
    }),
  )
  return server
}
