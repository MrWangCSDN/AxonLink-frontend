import { describe, expect, it } from 'vitest'
import { utils, write } from 'xlsx'
import { defaultReleaseAt, normalizeReleaseAt, readImportBatch } from './replayReleaseTime.js'
function file(batches, name='report.xlsx') {
  const workbook=utils.book_new()
  utils.book_append_sheet(workbook,utils.aoa_to_sheet([['批次号'],...batches.map(batch=>[batch])]),'问题清单')
  return new File([write(workbook,{type:'array',bookType:'xlsx'})],name)
}
describe('replay release cutoff',()=>{
  it('uses the previous batch day at noon across year/month/leap boundaries',()=>{
    expect(defaultReleaseAt('DB20261015-01')).toBe('2026-10-14T12:00:00')
    expect(defaultReleaseAt('RPT20260101-0001')).toBe('2025-12-31T12:00:00')
    expect(defaultReleaseAt('DZ20240301-0001')).toBe('2024-02-29T12:00:00')
    expect(defaultReleaseAt('DB20260230-01')).toBe('')
    expect(defaultReleaseAt('')).toBe('')
  })
  it('normalizes native minute values to seconds and rejects incomplete or impossible values',()=>{
    expect(normalizeReleaseAt('2026-10-14T12:00')).toBe('2026-10-14 12:00:00')
    expect(normalizeReleaseAt('2026-10-14T12:00:01')).toBe('2026-10-14 12:00:01')
    for(const value of ['', '2026-02-30T12:00:00','2026-10-14T24:00:00','2026-10-14T12:60:00']) expect(normalizeReleaseAt(value)).toBe('')
  })
  it('reads the workbook batch before a conflicting filename hint',async()=>{
    expect(await readImportBatch(file(['DB20261015-01'],'DB20261016-01.xlsx'),'DB')).toBe('DB20261015-01')
    expect(await readImportBatch(file(['RPT20261015-001']))).toBe('RPT20261015-001')
    expect(await readImportBatch(file(['DZ20261015-001']))).toBe('DZ20261015-001')
  })
  it('uses issue sheet batches, ignoring previous-day summary sections and accepting same-day sequences',async()=>{
    const workbook=utils.book_new()
    utils.book_append_sheet(workbook,utils.aoa_to_sheet([['批次'],['RPT20261015-01'],['RPT20261015-02']]),'公共组')
    utils.book_append_sheet(workbook,utils.aoa_to_sheet([['RPT20261014-01'],['RPT20261015-01']]),'汇总信息')
    const input=new File([write(workbook,{type:'array',bookType:'xlsx'})],'report.xlsx')
    expect(await readImportBatch(input)).toBe('RPT20261015-01')
  })
  it('does not silently choose among mixed batches, and supports old report filenames',async()=>{
    expect(await readImportBatch(file(['DB20261015-01','DB20261016-01'],'DB20261017-01.xlsx'),'DB')).toBe('')
    expect(await readImportBatch(new File(['old'],'每日核对结果-20261015.xlsx'),'DB')).toBe('DB20261015-01')
    expect(await readImportBatch(new File(['old'],'report.xlsx'),'DB')).toBe('')
  })
})
