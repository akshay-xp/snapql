import { onCleanup } from "solid-js"

export function Splitter(props: {
  stacked: boolean
  onDrag: (clientX: number, clientY: number) => void
}) {
  // Window listeners keep the drag going when the pointer leaves the handle.
  const move = (e: PointerEvent) => props.onDrag(e.clientX, e.clientY)
  const up = () => {
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
  }
  onCleanup(up)

  return (
    <hr
      aria-orientation={props.stacked ? "horizontal" : "vertical"}
      class="absolute m-0 border-0"
      classList={{
        "inset-x-0 -top-0.5 h-1 w-full cursor-row-resize": props.stacked,
        "inset-y-0 -left-0.5 h-full w-1 cursor-col-resize": !props.stacked,
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", up)
      }}
    />
  )
}
