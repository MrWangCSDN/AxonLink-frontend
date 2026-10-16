/** Copy complete text, including on HTTP intranet pages without Clipboard API access. */
export async function copyText(value) {
  const text = String(value)
  try {
    if (window.isSecureContext && typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Restricted browsers can reject the API even in a secure context.
  }

  const activeElement = document.activeElement
  const selection = window.getSelection()
  const ranges = []
  for (let index = 0; index < (selection?.rangeCount ?? 0); index += 1) {
    ranges.push(selection.getRangeAt(index).cloneRange())
  }
  const fieldSelection = typeof activeElement?.selectionStart === 'number'
    ? [activeElement.selectionStart, activeElement.selectionEnd, activeElement.selectionDirection]
    : null
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.readOnly = true
  textarea.style.cssText = 'position:fixed;left:-9999px;opacity:0'

  try {
    document.body.appendChild(textarea)
    textarea.focus({ preventScroll: true })
    textarea.select()
    return typeof document.execCommand === 'function' && document.execCommand('copy') === true
  } catch {
    return false
  } finally {
    textarea.remove()
    try {
      activeElement?.focus({ preventScroll: true })
      if (fieldSelection) activeElement.setSelectionRange(...fieldSelection)
    } catch {
      // Focus may no longer be restorable if the original element was removed.
    }
    try {
      if (selection) {
        selection.removeAllRanges()
        for (const range of ranges) selection.addRange(range)
      }
    } catch {
      // A selected node may have been removed while copying.
    }
  }
}
