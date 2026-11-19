export const displayTableName = row => row.customSql?.sourceTableName || row.sourceTableName || row.tableName

export const formatField = field => field.columnComment
  ? `${field.columnName}(${field.columnComment})`
  : field.columnName

export const formatComparisonKey = key => {
  if (!key) return '历史默认主键'
  if (key.indexType === 'RESULT_KEY') return `结果比对键 · ${key.columnNames.join('、')}`
  return `${key.indexType === 'PRIMARY_KEY' ? '主键' : '唯一索引'} · ${key.indexName} · ${key.columnNames.join('、')}`
}

export const queryConditionText = row => {
  if (row.customSql) return row.customSql.sql
  const parts = []
  const whereSql = String(row?.whereSql || '').trim().replace(/^where\s+/i, '')
  if (whereSql) parts.push(`WHERE ${whereSql}`)
  if (row?.compareLimit !== null && row?.compareLimit !== undefined && row?.compareLimit !== '') {
    const primaryKeys = row.comparisonKey?.columnNames || [...(row.fields || [])]
      .filter(field => field.primaryKey)
      .sort((left, right) => (left.primaryKeyOrder ?? left.comparisonOrder ?? Number.MAX_SAFE_INTEGER)
        - (right.primaryKeyOrder ?? right.comparisonOrder ?? Number.MAX_SAFE_INTEGER))
      .map(field => field.columnName)
    if (primaryKeys.length) parts.push(`ORDER BY ${primaryKeys.join(', ')}`)
    parts.push(`LIMIT ${row.compareLimit}`)
  }
  return parts.join(' ') || '全表'
}

export const personLabel = (name, username, fallback) => {
  const account = username || fallback
  if (name?.includes('(') && name.endsWith(')')) return name
  if (!name && !account) return '-'
  if (!name || !account || name === account) return name || account
  return `${name}(${account})`
}
