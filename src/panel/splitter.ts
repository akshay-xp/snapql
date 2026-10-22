export const MIN_PANE = 200

export function clampWidth(
  width: number,
  container: number,
  min = MIN_PANE,
): number {
  if (container < 2 * min) return container / 2
  return Math.min(Math.max(width, min), container - min)
}
