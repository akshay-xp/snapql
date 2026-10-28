export const MIN_PANE = 200

export function clampSize(
  size: number,
  container: number,
  min = MIN_PANE,
): number {
  if (container < 2 * min) return container / 2
  return Math.min(Math.max(size, min), container - min)
}

// Like DevTools' auto layout: side-docked (tall) panels stack list over detail.
export const isStacked = (width: number, height: number) => width < height
