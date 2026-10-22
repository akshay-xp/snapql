import { createSignal, onCleanup } from "solid-js"
import { copyToClipboard } from "./copy"
import { IconButton } from "./icon-button"

const COPIED_MS = 1500

export function CopyButton(props: {
  label: string
  value: () => string
  captioned?: boolean
}) {
  const [copied, setCopied] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))
  const copy = async () => {
    await copyToClipboard(props.value())
    setCopied(true)
    clearTimeout(timer)
    timer = setTimeout(() => setCopied(false), COPIED_MS)
  }
  return (
    <IconButton
      label={copied() ? "Copied" : props.label}
      caption={props.captioned ? (copied() ? "Copied" : "Copy") : undefined}
      onClick={copy}
    >
      {copied() ? (
        <path d="m5 12 5 5 9-10" />
      ) : (
        <>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a1 1 0 0 1 1-1h9" />
        </>
      )}
    </IconButton>
  )
}
