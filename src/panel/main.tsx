import { render } from "solid-js/web"
import { onRequestFinished } from "../browser/devtools"
import { startCapture } from "../capture/capture"
import { createStore } from "../capture/store"
import { decoders } from "../decoders"
import { App } from "./app"
import "./index.css"

const store = createStore()
startCapture(onRequestFinished, store, decoders)

render(
  () => <App store={store} />,
  document.getElementById("root") as HTMLElement,
)
