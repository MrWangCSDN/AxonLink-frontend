import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard.js'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')

function restoreProperty(target, name, descriptor) {
  if (descriptor) Object.defineProperty(target, name, descriptor)
  else delete target[name]
}

function clipboardContext(secure, clipboard) {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: secure })
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
}

describe('copyText', () => {
  let execCommand

  beforeEach(() => {
    document.body.innerHTML = ''
    window.getSelection().removeAllRanges()
    clipboardContext(true, undefined)
    execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    restoreProperty(navigator, 'clipboard', originalClipboard)
    restoreProperty(window, 'isSecureContext', originalSecureContext)
    restoreProperty(document, 'execCommand', originalExecCommand)
    document.body.innerHTML = ''
    window.getSelection().removeAllRanges()
  })

  it('copies the complete multiline text through the secure Clipboard API', async () => {
    const text = '表英文名 koba_off_sheet_acct\n表中文名 表外账户\n  完整内容  '
    const writeText = vi.fn().mockResolvedValue(undefined)
    clipboardContext(true, { writeText })

    expect(await copyText(text)).toBe(true)
    expect(writeText).toHaveBeenCalledWith(text)
    expect(execCommand).not.toHaveBeenCalled()
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('preserves the numeric value zero', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    clipboardContext(true, { writeText })

    expect(await copyText(0)).toBe(true)
    expect(writeText).toHaveBeenCalledWith('0')
  })

  it.each([
    ['HTTP intranet', false, { writeText: vi.fn() }],
    ['missing Clipboard API', true, undefined],
    ['missing writeText', true, {}],
  ])('copies full text with a textarea in a %s context', async (_name, secure, clipboard) => {
    clipboardContext(secure, clipboard)
    const text = '完整的很长表名 long_table_name\n中文名称\n  保留空格  '
    execCommand.mockImplementation(command => {
      expect(command).toBe('copy')
      const textarea = document.querySelector('textarea')
      expect(textarea.value).toBe(text)
      expect(document.activeElement).toBe(textarea)
      expect(textarea.selectionStart).toBe(0)
      expect(textarea.selectionEnd).toBe(text.length)
      return true
    })

    expect(await copyText(text)).toBe(true)
    if (clipboard?.writeText) expect(clipboard.writeText).not.toHaveBeenCalled()
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('falls back when Clipboard API permission is rejected', async () => {
    clipboardContext(true, { writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    execCommand.mockImplementation(() => document.querySelector('textarea').value === '无需处理\n原因')

    expect(await copyText('无需处理\n原因')).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('reports failure when Clipboard API permission is rejected and fallback is denied', async () => {
    clipboardContext(true, { writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    execCommand.mockReturnValue(false)

    expect(await copyText('新内容')).toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('reports failure and cleans up if neither clipboard method is available', async () => {
    Object.defineProperty(document, 'execCommand', { configurable: true, value: undefined })

    expect(await copyText(0)).toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
  })

  it.each(['false', 'throw'])('reports failure and restores input focus/selection when fallback returns %s', async failure => {
    const input = document.createElement('input')
    input.value = '正在编辑的筛选条件'
    document.body.appendChild(input)
    input.focus()
    input.setSelectionRange(2, 5, 'backward')
    execCommand.mockImplementation(() => {
      if (failure === 'throw') throw new Error('Copy unavailable')
      return false
    })

    expect(await copyText('待复制内容')).toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
    expect(document.activeElement).toBe(input)
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([2, 5, 'backward'])
    expect(input.value).toBe('正在编辑的筛选条件')
  })

  it('restores an existing document selection after a successful fallback', async () => {
    const button = document.createElement('button')
    button.textContent = '复制'
    const paragraph = document.createElement('p')
    paragraph.textContent = '保留原来的文本选择'
    document.body.append(button, paragraph)
    button.focus()
    const range = document.createRange()
    range.setStart(paragraph.firstChild, 2)
    range.setEnd(paragraph.firstChild, 5)
    window.getSelection().addRange(range)
    execCommand.mockImplementation(() => {
      window.getSelection().removeAllRanges()
      return true
    })

    expect(await copyText('新内容')).toBe(true)
    expect(document.activeElement).toBe(button)
    expect(window.getSelection().toString()).toBe('原来的')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('cleans up and returns false if selecting the temporary textarea fails', async () => {
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()
    vi.spyOn(HTMLTextAreaElement.prototype, 'select').mockImplementation(() => { throw new Error('Cannot select') })

    expect(await copyText('新内容')).toBe(false)
    expect(document.activeElement).toBe(button)
    expect(document.querySelector('textarea')).toBeNull()
    expect(execCommand).not.toHaveBeenCalled()
  })
})
