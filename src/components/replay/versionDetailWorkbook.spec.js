import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

vi.mock('../../api/replayDatabaseComparison.js', () => ({ searchVersionSnapshot: vi.fn() }))
vi.mock('xlsx', async importOriginal => ({ ...await importOriginal(), writeFile: vi.fn() }))

import { searchVersionSnapshot } from '../../api/replayDatabaseComparison.js'
import { exportVersionDetails } from './versionDetailWorkbook.js'

const versionNo = '20261119-093432'
const field = (columnName, comparisonOrder, columnComment = '') => ({
  columnName, columnComment, comparisonOrder, ordinalPosition: comparisonOrder, primaryKey: false,
})
const table = (overrides = {}) => ({
  sourceRegistrationId: 1,
  tableName: 'acct_master', tableComment: '账户主表', domainName: '存款组',
  fields: [field('balance', 2, '余额'), field('acct_no', 1, '账号')],
  comparisonKey: { indexType: 'UNIQUE_INDEX', indexName: 'uk_acct', columnNames: ['acct_no'] },
  whereSql: "status = 'A'", compareLimit: 100,
  groupOwnerName: '张三', groupOwnerUsername: 'zhangsan', groupOwnerEmpNo: '001',
  ...overrides,
})
const page = (items, total = items.length) => ({ items, total, page: 0, size: 200 })
const downloadedSheet = () => {
  const workbook = XLSX.writeFile.mock.calls[0][0]
  const reloaded = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
  return reloaded.Sheets['表清单明细']
}

beforeEach(() => vi.resetAllMocks())

describe('version detail Excel export', () => {
  it('writes every field in comparison order and merges only each table’s other five columns', async () => {
    const first = table()
    searchVersionSnapshot.mockResolvedValue(page([
      first,
      table({ sourceRegistrationId: 2, tableName: 'acct_detail', tableComment: '账户明细', fields: [field('id', 1)] }),
    ]))

    await exportVersionDetails(versionNo, {})

    expect(XLSX.writeFile.mock.calls[0][1]).toBe('replay-db-compare-details-20261119-093432.xlsx')
    const sheet = downloadedSheet()
    expect(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })).toEqual([
      ['领域', '表英文名 / 中文名', '比对字段', '选择索引', '查询条件', '科技负责人'],
      ['存款组', 'acct_master / 账户主表', 'acct_no(账号)', '唯一索引 · uk_acct · acct_no', "WHERE status = 'A' ORDER BY acct_no LIMIT 100", '张三(zhangsan)'],
      ['', '', 'balance(余额)', '', '', ''],
      ['存款组', 'acct_detail / 账户明细', 'id', '唯一索引 · uk_acct · acct_no', "WHERE status = 'A' ORDER BY acct_no LIMIT 100", '张三(zhangsan)'],
    ])
    expect(sheet['!merges']).toEqual([
      { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
      { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
      { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } },
      { s: { r: 1, c: 4 }, e: { r: 2, c: 4 } },
      { s: { r: 1, c: 5 }, e: { r: 2, c: 5 } },
    ])
    expect(first.fields.map(item => item.columnName)).toEqual(['balance', 'acct_no'])
  })

  it('exports all matching pages with a captured copy of filters and ignores the displayed page', async () => {
    const filters = { page: 9, size: 50, domains: ['存款组'], fieldNames: ['acct_no'], tableKeyword: 'acct' }
    const firstPage = Array.from({ length: 200 }, (_, index) => table({
      sourceRegistrationId: index + 1, tableName: `acct_${index}`, fields: [field('acct_no', 1)],
    }))
    searchVersionSnapshot.mockImplementationOnce(async () => {
      filters.domains.push('贷款组')
      return page(firstPage, 201)
    }).mockResolvedValueOnce(page([table({ fields: [field('last_field', 1)] })], 201))

    await exportVersionDetails(versionNo, filters)

    expect(searchVersionSnapshot.mock.calls).toEqual([
      [versionNo, { page: 0, size: 200, domains: ['存款组'], fieldNames: ['acct_no'], tableKeyword: 'acct' }],
      [versionNo, { page: 1, size: 200, domains: ['存款组'], fieldNames: ['acct_no'], tableKeyword: 'acct' }],
    ])
    const sheet = downloadedSheet()
    expect(sheet['!ref']).toBe('A1:F202')
    expect(sheet.C202.v).toBe('last_field')
    expect(XLSX.writeFile).toHaveBeenCalledTimes(1)
  })

  it('preserves historical keys, full-table conditions, empty fields, and owner fallbacks', async () => {
    searchVersionSnapshot.mockResolvedValue(page([table({
      tableComment: '', domainName: '', fields: [], comparisonKey: null,
      whereSql: '', compareLimit: null, groupOwnerName: '', groupOwnerUsername: '', groupOwnerEmpNo: '0007',
    })]))

    await exportVersionDetails(versionNo, {})

    const sheet = downloadedSheet()
    expect(XLSX.utils.sheet_to_json(sheet, { header: 1 })[1]).toEqual([
      '-', 'acct_master / -', '', '历史默认主键', '全表', '0007',
    ])
    expect(sheet['!merges'] || []).toEqual([])
  })

  it('keeps custom SQL source table, result keys, and outer comparison limits in the workbook', async () => {
    searchVersionSnapshot.mockResolvedValue(page([table({
      tableName: 'sql_virtual', tableComment: '按币种汇总',
      customSql: { sourceTableName: 'acct_master', sql: 'SELECT currency, SUM(balance) AS total FROM acct_master GROUP BY currency' },
      comparisonKey: { indexType: 'RESULT_KEY', columnNames: ['currency'] },
      fields: [field('currency', 1), field('total', 2)], compareLimit: 20,
    })]))

    await exportVersionDetails(versionNo, {})

    const sheet = downloadedSheet()
    expect(sheet.B2.v).toBe('acct_master / 按币种汇总')
    expect(sheet.D2.v).toBe('结果比对键 · currency')
    expect(sheet.E2.v).toBe('SELECT currency, SUM(balance) AS total FROM acct_master GROUP BY currency；外层比对条数 20')
  })

  it('writes formula-like labels and leading-zero identifiers as text', async () => {
    searchVersionSnapshot.mockResolvedValue(page([table({
      fields: [field('=1+1', 1)], groupOwnerName: '', groupOwnerUsername: '', groupOwnerEmpNo: '0007',
    })]))

    await exportVersionDetails(versionNo, {})

    const sheet = downloadedSheet()
    expect(sheet.C2).toMatchObject({ t: 's', v: '=1+1' })
    expect(sheet.C2.f).toBeUndefined()
    expect(sheet.F2).toMatchObject({ t: 's', v: '0007' })
  })

  it('keeps long supported SQL intact in linked chunks instead of exceeding Excel’s cell limit', async () => {
    const sql = `SELECT '${'a'.repeat(31991)}😀${'b'.repeat(1500)}' AS note, id FROM acct_master`
    searchVersionSnapshot.mockResolvedValue(page([table({
      customSql: { sourceTableName: 'acct_master', sql }, compareLimit: null,
    })]))

    await exportVersionDetails(versionNo, {})

    const workbook = XLSX.writeFile.mock.calls[0][0]
    const reloaded = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
    expect(reloaded.SheetNames).toEqual(['表清单明细', '查询条件明细'])
    const main = reloaded.Sheets['表清单明细']
    expect(main.E2.v).toContain('完整查询条件见「查询条件明细」')
    expect(main.E2.l.Target).toBe("#'查询条件明细'!A2")
    const chunks = XLSX.utils.sheet_to_json(reloaded.Sheets['查询条件明细'], { header: 1 }).slice(1)
    expect(chunks.map(row => row[1])).toEqual(['1/2', '2/2'])
    expect(chunks.map(row => row[2]).join('')).toBe(sql)
    expect(chunks.every(row => row[2].length <= 32000)).toBe(true)
    expect(chunks[0][2].endsWith('a')).toBe(true)
    expect(chunks[1][2].startsWith('😀')).toBe(true)
  })

  it('shows an empty-result error without creating a file', async () => {
    searchVersionSnapshot.mockResolvedValue(page([]))

    await expect(exportVersionDetails(versionNo, {})).rejects.toThrow('没有可导出的明细')
    expect(XLSX.writeFile).not.toHaveBeenCalled()
  })

  it('does not download partial results after a later page fails or is unexpectedly empty', async () => {
    const firstPage = Array.from({ length: 200 }, () => table())
    searchVersionSnapshot.mockResolvedValueOnce(page(firstPage, 201)).mockRejectedValueOnce(new Error('网络中断'))
    await expect(exportVersionDetails(versionNo, {})).rejects.toThrow('网络中断')
    expect(XLSX.writeFile).not.toHaveBeenCalled()

    searchVersionSnapshot.mockResolvedValueOnce(page(firstPage, 201)).mockResolvedValueOnce(page([], 201))
    await expect(exportVersionDetails(versionNo, {})).rejects.toThrow('明细数据加载不完整')
    expect(XLSX.writeFile).not.toHaveBeenCalled()
  })
})
