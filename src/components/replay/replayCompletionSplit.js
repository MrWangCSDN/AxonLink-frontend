export const DEFAULT_TOP_RATIO = 0.38
export const MIN_TOP_HEIGHT = 230
export const MIN_BOTTOM_HEIGHT = 260

export function clampTopHeight(requestedHeight, availableHeight) {
  const height = Math.max(0, Number(availableHeight) || 0)
  if (height < MIN_TOP_HEIGHT + MIN_BOTTOM_HEIGHT) return Math.round(height / 2)
  return Math.min(
    height - MIN_BOTTOM_HEIGHT,
    Math.max(MIN_TOP_HEIGHT, Math.round(Number(requestedHeight) || 0)),
  )
}

export function defaultTopHeight(availableHeight) {
  return clampTopHeight(availableHeight * DEFAULT_TOP_RATIO, availableHeight)
}
