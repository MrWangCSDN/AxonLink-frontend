import { describe, expect, it, vi } from 'vitest'
import {
  REPLAY_MODAL_MOTION_MS,
  replayModalMotionReduced,
  replayModalMotionVariables,
  waitForReplayModalMotion,
} from './replayModalMotion.js'

describe('replay modal motion', () => {
  it('maps the dialog center and size to the source button', () => {
    expect(replayModalMotionVariables(
      { left: 100, top: 80, width: 800, height: 400 },
      { left: 40, top: 20, width: 160, height: 40 },
    )).toEqual({
      '--replay-window-x': '-380px',
      '--replay-window-y': '-240px',
      '--replay-window-scale-x': '0.2',
      '--replay-window-scale-y': '0.1',
    })
  })

  it('honors reduced motion', () => {
    expect(replayModalMotionReduced(() => ({ matches: true }))).toBe(true)
    expect(replayModalMotionReduced(() => ({ matches: false }))).toBe(false)
  })

  it('finishes from animationend without waiting for the fallback', async () => {
    vi.useFakeTimers()
    try {
      const element = document.createElement('div')
      const finished = waitForReplayModalMotion(element, REPLAY_MODAL_MOTION_MS, () => ({ matches: false }))
      element.dispatchEvent(new Event('animationend'))
      await expect(finished).resolves.toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})
