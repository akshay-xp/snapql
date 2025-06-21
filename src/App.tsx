import { useEffect, useState } from "react"

function App() {
  const [requests, setRequests] = useState<chrome.devtools.network.Request[]>(
    []
  )

  useEffect(() => {
    chrome.devtools.network.onRequestFinished.addListener((request) => {
      if (
        request.request.method === "POST" &&
        request.request.postData &&
        request.request.postData.text
      ) {
        setRequests((prev) => {
          return [request, ...prev]
        })
        console.log(JSON.parse(request.request.postData?.text))
      }
    })
  }, [])

  return (
    <main>
      {requests.map((request) => (
        <p key={request._request_id}>
          {JSON.parse(request.request.postData?.text ?? "")?.operationName}
        </p>
      ))}
    </main>
  )
}

export default App
