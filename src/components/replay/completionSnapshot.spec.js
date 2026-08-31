import { describe, expect, it, vi } from 'vitest'
import {
  buildCompletionSnapshotFilename,
  createCompletionSnapshotBlob,
  downloadAndCopyCompletionSnapshot,
} from './completionSnapshot.js'

function createCanvasEnvironment() {
  const writtenTexts = []
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
    fillText: vi.fn(text => writtenTexts.push(String(text))),
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
  return { blob, canvas, context, documentRef, writtenTexts }
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
  }
}

describe('completionSnapshot', () => {
  it('builds a safe filename containing the group and effective date range', () => {
    expect(buildCompletionSnapshotFilename({
      groupName: '存款组',
      startDate: '2026-08-28',
      endDate: '2026-08-30',
    })).toBe('计划完成情况-存款组-2026-08-28至2026-08-30.png')
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
    }
    const developers = [
      completionRow('负责人甲', 5),
      completionRow('负责人乙', 4),
      completionRow('负责人丙', 3),
    ]

    const result = await createCompletionSnapshotBlob({
      group,
      developers,
      startDate: '2026-08-28',
      endDate: '2026-08-30',
    }, { documentRef: environment.documentRef, pixelRatio: 2 })

    expect(result).toBe(environment.blob)
    expect(environment.writtenTexts).toEqual(expect.arrayContaining([
      '计划完成情况',
      '存款组',
      '2026-08-28 至 2026-08-30',
      '负责人甲',
      '负责人乙',
      '负责人丙',
    ]))
    expect(environment.canvas.height).toBeGreaterThan(500)
    expect(environment.canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
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
