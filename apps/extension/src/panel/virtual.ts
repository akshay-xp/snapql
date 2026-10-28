export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan: number,
): { start: number; end: number } {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const end = Math.min(
    count,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan,
  )
  return { start, end }
}

export function scrollToRow(
  index: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
): number | undefined {
  const top = index * rowHeight
  const bottom = top + rowHeight
  if (top < scrollTop) return top
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight
}
