import { createSignal } from "solid-js"
import { render } from "solid-js/web"
import {
  evalInPage,
  getHAR,
  getTheme,
  onNavigated,
  onRequestFinished,
  onThemeChanged,
  probeScript,
  reloadWithScript,
} from "../browser/devtools"
import { startCapture } from "../capture/capture"
import { pollProbe } from "../capture/probe-source"
import { createStore } from "../capture/store"
import { decoders } from "../decoders"
import { App } from "./app"
import { createSchemas } from "./schemas"
import { defaultTheme, type Theme, themeVars } from "./themes"
import "./index.css"

function applyTheme(theme: Theme) {
  const root = document.documentElement
  for (const [name, value] of Object.entries(themeVars(theme))) {
    root.style.setProperty(name, value)
  }
  root.dataset.theme = theme.id
  root.dataset.themeKind = theme.kind
  // Native scrollbars and form controls otherwise stay light.
  root.style.colorScheme = theme.kind
}

applyTheme(defaultTheme(getTheme()))
onThemeChanged((kind) => applyTheme(defaultTheme(kind)))

const store = createStore()
const [preserveLog, setPreserveLog] = createSignal(false)
const script = probeScript()
startCapture(
  {
    onRequestFinished,
    getHAR,
    onNavigated,
    onProbe: (cb) =>
      pollProbe(
        {
          evaluate: evalInPage,
          script: () => script,
          onNavigated,
          visible: () => document.visibilityState === "visible",
        },
        cb,
      ),
  },
  store,
  decoders,
  preserveLog,
)

let storage: Storage | undefined
try {
  storage = localStorage
} catch {}
const schemas = createSchemas(storage, (files) =>
  import("../decoders/proto-schema").then((m) => m.parseProto(files)),
)

render(
  () => (
    <App
      store={store}
      preserveLog={preserveLog}
      setPreserveLog={setPreserveLog}
      onReloadCapture={async () => reloadWithScript(await script)}
      schemas={schemas}
    />
  ),
  document.getElementById("root") as HTMLElement,
)
