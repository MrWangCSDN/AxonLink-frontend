const batchPattern = /^(?:DB|RPT|DZ)(\d{4})(\d{2})(\d{2})-.+$/
const pad = value => String(value).padStart(2, '0')

function batchDay(batchNo) {
  const match = String(batchNo || '').trim().match(batchPattern)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null
}

export function defaultReleaseAt(batchNo) {
  const date = batchDay(batchNo)
  if (!date) return ''
  date.setUTCDate(date.getUTCDate() - 1)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T12:00:00`
}

export function normalizeReleaseAt(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return ''
  const [, date, hour, minute, second = '00'] = match
  if (!batchDay(`DB${date.replaceAll('-', '')}-01`) || +hour > 23 || +minute > 59 || +second > 59) return ''
  return `${date} ${hour}:${minute}:${second}`
}

/** Preview only. The backend remains responsible for validating the workbook's batch. */
export async function readImportBatch(file, family = 'ISSUE') {
  if (!file) return ''
  const pattern = family === 'DB' ? /^DB\d{8}-.+$/ : /^(?:RPT|DZ)\d{8}-.+$/
  try {
    const { read, utils } = await import('xlsx')
    const workbook = read(await file.arrayBuffer(), { type: 'array' })
    const batches = new Set()
    const issueSheets = workbook.SheetNames.filter(name => /^(?:沙箱-)?(?:公共|存款|贷款|结算)组$/.test(name))
    const databaseSheets = workbook.SheetNames.filter(name => ['表明细', '表字段明细'].includes(name))
    const names = family === 'DB'
      ? (databaseSheets.length ? databaseSheets : workbook.SheetNames)
      : (issueSheets.length ? issueSheets : workbook.SheetNames.filter(name => name !== '汇总信息'))
    for (const name of names) {
      for (const row of utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false })) {
        for (const cell of row) {
          const value = String(cell ?? '').trim()
          if (pattern.test(value)) batches.add(value)
        }
      }
    }
    if (batches.size) {
      const dates = new Set([...batches].map(defaultReleaseAt))
      return batches.size === 1 || (family !== 'DB' && dates.size === 1 && !dates.has('')) ? [...batches][0] : ''
    }
    // Daily-only workbooks put the active batch in the final section of 汇总信息.
    if (family !== 'DB' && workbook.Sheets['汇总信息']) {
      const summaryBatches = utils.sheet_to_json(workbook.Sheets['汇总信息'], { header: 1, raw: false })
        .flat().map(value => String(value ?? '').trim()).filter(value => pattern.test(value))
      if (summaryBatches.length) return summaryBatches.at(-1)
    }
  } catch {
    // Older reports may need their batch supplied manually. Import validation is server-side.
  }
  const name = file.name || ''
  const batch = name.match(family === 'DB' ? /DB\d{8}-[A-Za-z0-9_-]+/ : /(?:RPT|DZ)\d{8}-[A-Za-z0-9_-]+/)?.[0]
  if (batch) return batch
  const date = family === 'DB' ? name.match(/(?:每日核对结果-|daily-results-)(\d{8})/)?.[1] : ''
  return date ? `DB${date}-01` : ''
}
