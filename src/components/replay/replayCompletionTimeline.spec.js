import { describe, expect, it } from 'vitest'
import {
  overlapDragRange,
  timelineCenterGutter,
  timelineIndexFromClientX,
} from './replayCompletionTimeline.js'

describe('replay completion timeline interactions', () => {
  it('adds symmetric edge space only when an overflowing timeline needs its edge dates centered', () => {
    expect(timelineCenterGutter(1000, 3456, 36)).toBe(452)
    expect(timelineCenterGutter(1000, 1000, 5)).toBe(0)
    expect(timelineCenterGutter(1000, 3456, 0)).toBe(0)
  })

  it('snaps pointer coordinates to the nearest real date index', () => {
    expect(timelineIndexFromClientX(90, 100, 400, 5)).toBe(0)
    expect(timelineIndexFromClientX(295, 100, 400, 5)).toBe(2)
    expect(timelineIndexFromClientX(520, 100, 400, 5)).toBe(4)
  })

  it('chooses the start edge when an overlapped handle first moves left', () => {
    expect(overlapDragRange(3, 1, null)).toEqual({
      edge: 'start',
      startIndex: 1,
      endIndex: 3,
    })
  })

  it('chooses the end edge when an overlapped handle first moves right', () => {
    expect(overlapDragRange(3, 5, null)).toEqual({
      edge: 'end',
      startIndex: 3,
      endIndex: 5,
    })
  })

  it('keeps the first chosen edge locked when the pointer crosses back over the origin', () => {
    expect(overlapDragRange(3, 5, 'start')).toEqual({
      edge: 'start',
      startIndex: 3,
      endIndex: 3,
    })
    expect(overlapDragRange(3, 1, 'end')).toEqual({
      edge: 'end',
      startIndex: 3,
      endIndex: 3,
    })
  })

  it('does not choose an edge before reaching another real date point', () => {
    expect(overlapDragRange(3, 3, null)).toEqual({
      edge: null,
      startIndex: 3,
      endIndex: 3,
    })
  })
})
