import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOP_RATIO,
  MIN_BOTTOM_HEIGHT,
  MIN_TOP_HEIGHT,
  clampTopHeight,
  defaultTopHeight,
} from './replayCompletionSplit.js'

describe('replay completion split calculations', () => {
  it('uses 38 percent within both pane minimums', () => {
    expect(DEFAULT_TOP_RATIO).toBe(0.38)
    expect(defaultTopHeight(800)).toBe(304)
  })

  it('prevents either pane from disappearing', () => {
    expect(clampTopHeight(20, 800)).toBe(MIN_TOP_HEIGHT)
    expect(clampTopHeight(790, 800)).toBe(800 - MIN_BOTTOM_HEIGHT)
  })

  it('splits evenly if the viewport cannot satisfy both minimums', () => {
    expect(clampTopHeight(300, 400)).toBe(200)
    expect(defaultTopHeight(400)).toBe(200)
  })
})
