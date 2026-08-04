import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const replayPageSource = readFileSync(resolve(process.cwd(), 'src/components/replay/ReplayIssuePage.vue'), 'utf8')
const transactionAnalysisSource = readFileSync(resolve(process.cwd(), 'src/views/TransactionAnalysis.vue'), 'utf8')

function maxWidthFor(source, selector) {
  const mediaQuery = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g
  let match

  while ((match = mediaQuery.exec(source))) {
    let depth = 1
    let index = mediaQuery.lastIndex
    while (depth > 0 && index < source.length) {
      if (source[index] === '{') depth += 1
      if (source[index] === '}') depth -= 1
      index += 1
    }
    if (source.slice(mediaQuery.lastIndex, index).includes(selector)) return Number(match[1])
  }

  return null
}

describe('mobile navigation breakpoint contract', () => {
  it('keeps the replay trigger available through every off-canvas drawer width', () => {
    const triggerBreakpoint = maxWidthFor(replayPageSource, '.replay-icon-button.replay-mobile-navigation')
    const drawerBreakpoint = maxWidthFor(transactionAnalysisSource, '.page-body :deep(.cis)')

    expect(triggerBreakpoint).not.toBeNull()
    expect(drawerBreakpoint).not.toBeNull()
    expect(triggerBreakpoint).toBe(drawerBreakpoint)
  })
})
