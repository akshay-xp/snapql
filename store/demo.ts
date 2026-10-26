import { createServer, type IncomingMessage, type Server } from "node:http"

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
  return createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://demo").pathname
    if (path === "/")
      return res.writeHead(200, { "content-type": "text/html" }).end(travelPage)
    if (path === "/graphql") {
      const body = JSON.parse(await readBody(req))
      return json(res, Array.isArray(body) ? body.map(answer) : answer(body))
    }
    if (path === "/api/session")
      return json(res, {
        user: { id: "u_5f2a", name: "Sam Rivera", tier: "gold" },
        locale: "en-US",
      })
    if (path === "/api/newsletter") return res.writeHead(204).end()
    res.writeHead(404).end()
  })
}
