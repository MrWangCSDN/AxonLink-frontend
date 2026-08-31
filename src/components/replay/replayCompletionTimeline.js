export function timelineIndexFromClientX(clientX, left, width, pointCount) {
  if (pointCount <= 1 || width <= 0) return 0
  const ratio = Math.max(0, Math.min(1, (clientX - left) / width))
  return Math.round(ratio * (pointCount - 1))
}

export function timelineCenterGutter(viewportWidth, timelineWidth, pointCount) {
  if (pointCount <= 0 || viewportWidth <= 0 || timelineWidth <= viewportWidth) return 0
  const columnWidth = timelineWidth / pointCount
  return Math.max(0, (viewportWidth - columnWidth) / 2)
}

export function overlapDragRange(originIndex, nextIndex, edge = null) {
  let resolvedEdge = edge
  if (!resolvedEdge && nextIndex < originIndex) resolvedEdge = 'start'
  if (!resolvedEdge && nextIndex > originIndex) resolvedEdge = 'end'
  if (resolvedEdge === 'start') {
    return {
      edge: resolvedEdge,
      startIndex: Math.min(nextIndex, originIndex),
      endIndex: originIndex,
    }
  }
  if (resolvedEdge === 'end') {
    return {
      edge: resolvedEdge,
      startIndex: originIndex,
      endIndex: Math.max(nextIndex, originIndex),
    }
  }
  return { edge: null, startIndex: originIndex, endIndex: originIndex }
}
