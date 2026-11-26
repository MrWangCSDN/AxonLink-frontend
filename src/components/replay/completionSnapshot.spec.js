import { describe, expect, it, vi } from 'vitest'
import {
  buildCompletionSnapshotFilename,
  createCompletionSnapshotBlob,
  downloadAndCopyCompletionSnapshot,
} from './completionSnapshot.js'

function createCanvasEnvironment() {
  const writtenTexts = []
  const textRuns = []
  const context = {
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'middle',
    strokeStyle: '',
    lineWidth: 1,
    scale: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn((text, x, y) => {
      writtenTexts.push(String(text))
      textRuns.push({ text: String(text), x, y, align: context.textAlign, width: String(text).length * 12 })
    }),
    measureText: vi.fn(text => ({ width: String(text).length * 12 })),
  }
  const blob = new Blob(['snapshot'], { type: 'image/png' })
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn(callback => callback(blob)),
  }
  const documentRef = { createElement: vi.fn(() => canvas) }
  return { blob, canvas, context, documentRef, writtenTexts, textRuns }
}

function completionRow(name, plannedTotal) {
  return {
    matchedDeveloper: name,
    plannedTotal,
    onTimeFixedCount: 1,
    lateFixedCount: 2,
    unfinishedCount: 3,
    overdueUnfinishedCount: 4,
    completionRate: 60,
    pendingVerificationCount: 7,
  }
}

describe('completionSnapshot', () => {
  it('builds a safe filename containing replay type, group, and effective date range', () => {
    expect(buildCompletionSnapshotFilename({
      replayType: 'DZ',
      groupName: '存款组',
      startDate: '2026-08-28',
      endDate: '2026-08-30',
    })).toBe('计划完成情况-动账-存款组-2026-08-28至2026-08-30.png')
  })

  it('renders the effective date range, group total, and every developer into one PNG', async () => {
    const environment = createCanvasEnvironment()
    const group = {
      groupName: '存款组',
      plannedTotal: 12,
      onTimeFixedCount: 3,
      lateFixedCount: 4,
      unfinishedCount: 3,
      overdueUnfinishedCount: 2,
      completionRate: 58.33,
      pendingVerificationCount: 17,
    }
    const developers = [
      completionRow('负责人甲', 5),
      completionRow('负责人乙', 4),
      completionRow('负责人丙', 3),
    ]

    const result = await createCompletionSnapshotBlob({
      replayType: 'QUERY',
      group,
      developers,
      startDate: '2026-08-28',
      endDate: '2026-08-30',
    }, { documentRef: environment.documentRef, pixelRatio: 2 })

    expect(result).toBe(environment.blob)
    expect(environment.writtenTexts).toEqual(expect.arrayContaining([
      '计划完成情况',
      '查询',
      '存款组',
      '2026-08-28 至 2026-08-30',
      '负责人甲',
      '负责人乙',
      '负责人丙',
      '修复待验证',
      '17',
    ]))
    expect(environment.canvas.height).toBeGreaterThan(500)
    expect(environment.canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
  })

  it('renders ten columns with both averages and keeps every header and row inside the PNG', async () => {
    const environment = createCanvasEnvironment()
    const group = { ...completionRow('unused', 8), groupName: '存款组', averageLateFixedDays: 7.75, averageOverdueUnfinishedDays: 4.5 }
    const developers = [{ ...completionRow('负责人甲', 8), averageLateFixedDays: 1.5, averageOverdueUnfinishedDays: 0 }]
    await createCompletionSnapshotBlob({ group, developers, startDate: '2026-08-28', endDate: '2026-08-30' }, { documentRef: environment.documentRef, pixelRatio: 2 })

    const headers = environment.writtenTexts.indexOf('领域 / 开发负责人')
    expect(environment.writtenTexts.slice(headers, headers + 10)).toEqual([
      '领域 / 开发负责人', '计划问题数', '已修复', '延期修复', '平均延期天数(延期修复部分)', '未完成', '延期未完成', '平均延期天数(延期未完成部分)', '完成率', '修复待验证',
    ])
    const total = environment.writtenTexts.lastIndexOf('存款组')
    expect(environment.writtenTexts.slice(total, total + 10)).toEqual(['存款组', '8', '1', '2', '7.75', '3', '4', '4.50', '60.00%', '7'])
    const developer = environment.writtenTexts.indexOf('负责人甲')
    expect(environment.writtenTexts.slice(developer, developer + 10)).toEqual(['负责人甲', '8', '1', '2', '1.50', '3', '4', '0.00', '60.00%', '7'])
    for (const run of environment.textRuns) {
      const left = run.align === 'left' ? run.x : run.align === 'center' ? run.x - run.width / 2 : run.x - run.width
      const right = left + run.width
      expect(left, run.text).toBeGreaterThanOrEqual(0)
      expect(right, run.text).toBeLessThanOrEqual(environment.canvas.width / 2)
      expect(run.y, run.text).toBeLessThan(environment.canvas.height / 2)
    }
  })

  it.each([
    [null, undefined, '-', '-'],
    ['', Number.NaN, '-', '-'],
    [Number.POSITIVE_INFINITY, 'not-a-number', '-', '-'],
    [0, 0, '0.00', '0.00'],
    ['2.5', 3, '2.50', '3.00'],
  ])('renders average days %s and %s as %s and %s in the PNG', async (late, overdue, expectedLate, expectedOverdue) => {
    const environment = createCanvasEnvironment()
    const group = { ...completionRow('unused', 8), groupName: '存款组', averageLateFixedDays: late, averageOverdueUnfinishedDays: overdue }
    await createCompletionSnapshotBlob({ group, startDate: '2026-08-28', endDate: '2026-08-30' }, { documentRef: environment.documentRef })
    const index = environment.writtenTexts.lastIndexOf('存款组')
    expect(environment.writtenTexts[index + 4]).toBe(expectedLate)
    expect(environment.writtenTexts[index + 7]).toBe(expectedOverdue)
  })

  it('downloads and copies the same PNG blob', async () => {
    const blob = new Blob(['snapshot'], { type: 'image/png' })
    const anchor = { click: vi.fn(), remove: vi.fn(), style: {} }
    const documentRef = {
      body: { appendChild: vi.fn() },
      createElement: vi.fn(() => anchor),
    }
    const urlApi = {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    }
    const write = vi.fn().mockResolvedValue(undefined)
    const clipboardItem = vi.fn(function ClipboardItem(items) { this.items = items })

    await expect(downloadAndCopyCompletionSnapshot(blob, 'snapshot.png', {
      documentRef,
      urlApi,
      navigatorRef: { clipboard: { write } },
      ClipboardItemCtor: clipboardItem,
    })).resolves.toEqual({ copied: true })

    expect(anchor.download).toBe('snapshot.png')
    expect(anchor.href).toBe('blob:test')
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:test')
    expect(clipboardItem).toHaveBeenCalledWith({ 'image/png': blob })
    expect(write).toHaveBeenCalledOnce()
  })

  it('keeps the download successful when image clipboard writing fails', async () => {
    const blob = new Blob(['snapshot'], { type: 'image/png' })
    const anchor = { click: vi.fn(), remove: vi.fn(), style: {} }
    const documentRef = {
      body: { appendChild: vi.fn() },
      createElement: vi.fn(() => anchor),
    }
    const urlApi = {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    }

    await expect(downloadAndCopyCompletionSnapshot(blob, 'snapshot.png', {
      documentRef,
      urlApi,
      navigatorRef: { clipboard: { write: vi.fn().mockRejectedValue(new Error('denied')) } },
      ClipboardItemCtor: class ClipboardItem {},
    })).resolves.toEqual({ copied: false, previewUrl: 'blob:test' })

    expect(anchor.click).toHaveBeenCalledOnce()
    expect(urlApi.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('hands the downloaded image URL to the caller when image clipboard is unavailable', async () => {
    const blob = new Blob(['snapshot'], { type: 'image/png' })
    const anchor = { click: vi.fn(), remove: vi.fn(), style: {} }
    const documentRef = {
      body: { appendChild: vi.fn() },
      createElement: vi.fn(() => anchor),
    }
    const urlApi = {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    }

    await expect(downloadAndCopyCompletionSnapshot(blob, 'snapshot.png', {
      documentRef,
      urlApi,
      navigatorRef: {},
      ClipboardItemCtor: null,
    })).resolves.toEqual({ copied: false, previewUrl: 'blob:test' })

    expect(anchor.click).toHaveBeenCalledOnce()
    expect(urlApi.revokeObjectURL).not.toHaveBeenCalled()
  })
})
