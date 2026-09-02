export const REPLAY_MODAL_MOTION_MS = 300
export const REPLAY_MODAL_BACKDROP_MS = 220

export function replayModalMotionVariables(dialogRect, targetRect) {
  const dialogCenterX = dialogRect.left + dialogRect.width / 2
  const dialogCenterY = dialogRect.top + dialogRect.height / 2
  const targetCenterX = targetRect.left + targetRect.width / 2
  const targetCenterY = targetRect.top + targetRect.height / 2
  return {
    '--replay-window-x': `${targetCenterX - dialogCenterX}px`,
    '--replay-window-y': `${targetCenterY - dialogCenterY}px`,
    '--replay-window-scale-x': `${targetRect.width / dialogRect.width}`,
    '--replay-window-scale-y': `${targetRect.height / dialogRect.height}`,
  }
}

export function replayModalMotionReduced(matchMedia = globalThis.matchMedia) {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function waitForReplayModalMotion(
  element,
  duration = REPLAY_MODAL_MOTION_MS,
  matchMedia = globalThis.matchMedia,
) {
  if (!element || replayModalMotionReduced(matchMedia)) return Promise.resolve()
  return new Promise((resolve) => {
    let finished = false
    let fallback
    const complete = () => {
      if (finished) return
      finished = true
      element.removeEventListener('animationend', complete)
      clearTimeout(fallback)
      resolve()
    }
    fallback = setTimeout(complete, duration + 80)
    element.addEventListener('animationend', complete, { once: true })
  })
}
