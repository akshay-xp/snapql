import { type Accessor, createSignal, onCleanup } from "solid-js"
import { copyToClipboard } from "./copy"
import { IconButton } from "./icon-button"

const COPIED_MS = 1500

type CopyState = "idle" | "copied" | "failed"

// "copied" or "failed" for COPIED_MS after each copy, so the control can say
// so. Takes text, or a write for anything else (an image), which can fail.
export function createCopied(): [
  Accessor<CopyState>,
  (what: string | (() => Promise<void>)) => void,
] {
  const [state, setState] = createSignal<CopyState>("idle")
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))
  const copy = async (what: string | (() => Promise<void>)) => {
    try {
      await (typeof what === "string" ? copyToClipboard(what) : what())
      setState("copied")
    } catch {
      setState("failed")
    }
    clearTimeout(timer)
    timer = setTimeout(() => setState("idle"), COPIED_MS)
  }
  return [state, copy]
}

const SAID: Record<CopyState, string | undefined> = {
  idle: undefined,
  copied: "Copied",
  failed: "Copy failed",
}

export function CopyButton(props: {
  label: string
  value: () => string
  // Replaces copying value as text.
  write?: () => Promise<void>
  // Visible text beside the icon; reads "Copied" or "Copy failed" after a copy.
  caption?: string
}) {
  const [state, copy] = createCopied()
  const said = () => SAID[state()]
  return (
    <IconButton
      label={said() ?? props.label}
      caption={props.caption && (said() ?? props.caption)}
      onClick={() => copy(props.write ?? props.value())}
    >
      {state() === "copied" ? (
        <path d="m5 12 5 5 9-10" />
      ) : state() === "failed" ? (
        <path d="M6 6l12 12M18 6 6 18" />
      ) : (
        <>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a1 1 0 0 1 1-1h9" />
        </>
      )}
    </IconButton>
  )
}
