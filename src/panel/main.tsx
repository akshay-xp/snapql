import { createSignal } from "solid-js"
import { render } from "solid-js/web"
import { getHAR, onNavigated, onRequestFinished } from "../browser/devtools"
import { startCapture } from "../capture/capture"
import { createStore } from "../capture/store"
import { decoders } from "../decoders"
import { App } from "./app"
import "./index.css"

const store = createStore()
const [preserveLog, setPreserveLog] = createSignal(false)
startCapture(
  { onRequestFinished, getHAR, onNavigated },
  store,
  decoders,
  preserveLog,
)

render(
  () => (
    <App
      store={store}
      preserveLog={preserveLog}
      setPreserveLog={setPreserveLog}
    />
  ),
  document.getElementById("root") as HTMLElement,
)
