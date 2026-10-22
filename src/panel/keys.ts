export function nextIndex(
  key: string,
  current: number | undefined,
  count: number,
): number | undefined {
  if (count === 0) return
  const last = count - 1
  switch (key) {
    case "ArrowDown":
      return current === undefined ? 0 : Math.min(current + 1, last)
    case "ArrowUp":
      return current === undefined ? last : Math.max(current - 1, 0)
    case "Home":
      return 0
    case "End":
      return last
  }
}
