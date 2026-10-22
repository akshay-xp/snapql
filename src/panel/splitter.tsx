import { onCleanup } from "solid-js"

export function Splitter(props: { onDrag: (clientX: number) => void }) {
  // Window listeners keep the drag going when the pointer leaves the handle.
  const move = (e: PointerEvent) => props.onDrag(e.clientX)
  const up = () => {
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
  }
  onCleanup(up)

  return (
    <hr
      aria-orientation="vertical"
      class="absolute inset-y-0 -left-0.5 m-0 h-full w-1 cursor-col-resize border-0"
      onPointerDown={(e) => {
        e.preventDefault()
        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", up)
      }}
    />
  )
}
