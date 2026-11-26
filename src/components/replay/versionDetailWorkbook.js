import { searchVersionSnapshot } from '../../api/replayDatabaseComparison.js'
import {
  displayTableName,
  formatComparisonKey,
  formatField,
  personLabel,
  queryConditionText,
} from './versionSnapshotFormatters.js'

const headers = ['领域', '表英文名 / 中文名', '比对字段', '选择索引', '查询条件', '最大hash分区数', '科技负责人']
const pageSize = 200
const mergedColumns = [0, 1, 3, 4, 5, 6]
const queryDetailSheetName = '查询条件明细'

const splitQueryText = text => {
  const chunks = []
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 32000, text.length)
    const lastCode = text.charCodeAt(end - 1)
    if (end < text.length && lastCode >= 0xD800 && lastCode <= 0xDBFF) end -= 1
    chunks.push(text.slice(start, end))
    start = end
  }
  return chunks
}

const queryLabel = table => {
  const condition = queryConditionText(table)
  return table.customSql && table.compareLimit !== null && table.compareLimit !== undefined && table.compareLimit !== ''
    ? `${condition}；外层比对条数 ${table.compareLimit}`
    : condition
}

export const exportVersionDetails = async (versionNo, criteria = {}) => {
  if (!versionNo) throw new Error('请先选择版本')
  // Filters can contain arrays that the history dialog changes while requests are in flight.
  const filters = JSON.parse(JSON.stringify(criteria))
  const tables = []
  let total
  for (let page = 0; ; page += 1) {
    const result = await searchVersionSnapshot(versionNo, { ...filters, page, size: pageSize })
    if (!Array.isArray(result?.items) || !Number.isSafeInteger(result.total) || result.total < 0) {
      throw new Error('明细数据加载不完整，请重试')
    }
    total ??= result.total
    if (result.total !== total || tables.length + result.items.length > total
      || (!result.items.length && tables.length < total)) {
      throw new Error('明细数据加载不完整，请重试')
    }
    tables.push(...result.items)
    if (tables.length >= total) break
  }
  if (!tables.length) throw new Error('没有可导出的明细')

  const XLSX = await import('xlsx')
  const includesConfigurationIdentity = tables.some(table => table.configurationName != null
    || table.sourceTableName != null || table.comparisonCode != null)
  const rows = [includesConfigurationIdentity ? [...headers, '配置名称', '固定标识'] : headers]
  const tableColumns = includesConfigurationIdentity ? [...mergedColumns, 7, 8] : mergedColumns
  const merges = []
  const queryRows = [['表英文名 / 中文名', '片段序号', '查询条件（按序拼接）']]
  const queryLinks = []
  for (const table of tables) {
    const fields = [...(table.fields || [])].sort((left, right) =>
      (left.comparisonOrder ?? Number.MAX_SAFE_INTEGER) - (right.comparisonOrder ?? Number.MAX_SAFE_INTEGER))
    if (!fields.length) fields.push(null)
    const start = rows.length
    const tableLabel = `${displayTableName(table)} / ${table.tableComment || '-'}`
    let condition = queryLabel(table)
    // Excel limits each cell to 32,767 characters; retain longer SQL in linked, lossless chunks.
    if (condition.length > 32767) {
      const chunks = splitQueryText(condition)
      const firstRow = queryRows.length + 1
      chunks.forEach((chunk, index) => queryRows.push([tableLabel, `${index + 1}/${chunks.length}`, chunk]))
      condition = `${condition.slice(0, 500)}… 完整查询条件见「${queryDetailSheetName}」第 ${firstRow}–${queryRows.length} 行（按片段序号拼接）`
      queryLinks.push({ row: start, target: `#'${queryDetailSheetName}'!A${firstRow}` })
    }
    fields.forEach((field, index) => rows.push([
      index ? '' : table.domainName || '-',
      index ? '' : tableLabel,
      field ? formatField(field) : '',
      index ? '' : formatComparisonKey(table.comparisonKey),
      index ? '' : condition,
      index ? '' : table.maxPartitionNum ?? 64,
      index ? '' : personLabel(table.groupOwnerName, table.groupOwnerUsername, table.groupOwnerEmpNo),
      ...(includesConfigurationIdentity ? [index ? '' : table.configurationName || table.displayName || '默认配置',
        index ? '' : table.comparisonCode || table.tableName] : []),
    ]))
    if (fields.length > 1) tableColumns.forEach(column => merges.push({
      s: { r: start, c: column }, e: { r: rows.length - 1, c: column },
    }))
  }
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet['!merges'] = merges
  worksheet['!cols'] = [16, 44, 48, 68, 90, 20, 28, ...(includesConfigurationIdentity ? [28, 36] : [])].map(wch => ({ wch }))
  queryLinks.forEach(({ row, target }) => {
    worksheet[XLSX.utils.encode_cell({ r: row, c: 4 })].l = { Target: target }
  })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '表清单明细')
  if (queryRows.length > 1) {
    const querySheet = XLSX.utils.aoa_to_sheet(queryRows)
    querySheet['!cols'] = [44, 16, 100].map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(workbook, querySheet, queryDetailSheetName)
  }
  XLSX.writeFile(workbook, `replay-db-compare-details-${versionNo}.xlsx`, { compression: true })
}
