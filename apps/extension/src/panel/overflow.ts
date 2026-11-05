type Scroll = Pick<Element, "scrollLeft" | "clientWidth" | "scrollWidth">

// A pixel of slack: zoom leaves subpixel scroll positions at either end.
export const overflowEdges = ({
  scrollLeft,
  clientWidth,
  scrollWidth,
}: Scroll) => ({
  left: scrollLeft > 1,
  right: scrollLeft + clientWidth < scrollWidth - 1,
})
