const TEXT_OPERATORS = ['EQ', 'NE', 'LIKE', 'IN', 'IS_NULL', 'IS_NOT_NULL']
const ORDERED_OPERATORS = ['EQ', 'NE', 'GT', 'GE', 'LT', 'LE', 'IN', 'BETWEEN', 'IS_NULL', 'IS_NOT_NULL']
const BOOLEAN_OPERATORS = ['EQ', 'NE', 'IN', 'IS_NULL', 'IS_NOT_NULL']
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/

const typeFamily = dataType => {
  const normalized = String(dataType || '').toLowerCase()
  if (normalized.includes('bool')) return 'boolean'
  if (normalized.includes('timestamp') || normalized.includes('datetime')) return 'timestamp'
  if (normalized === 'date' || normalized.startsWith('date ')) return 'date'
  if (/(int|numeric|decimal|number|real|double|float|money)/.test(normalized)) return 'number'
  return 'text'
}

const validDate = value => {
  const match = DATE_PATTERN.exec(String(value).trim())
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
}

const valueMatchesType = (value, dataType) => {
  const normalized = String(value).trim()
  const family = typeFamily(dataType)
  if (family === 'number') return NUMBER_PATTERN.test(normalized)
  if (family === 'date') return validDate(normalized)
  if (family === 'timestamp') {
    const match = TIMESTAMP_PATTERN.exec(normalized)
    return Boolean(match && validDate(match[1])
      && Number(match[2]) <= 23 && Number(match[3]) <= 59
      && (match[4] === undefined || Number(match[4]) <= 59))
  }
  if (family === 'boolean') return /^(true|false)$/i.test(normalized)
  return true
}

export const emptyConditionTree = () => ({ connector: 'AND', groups: [] })

export function operatorsForDataType(dataType) {
  const family = typeFamily(dataType)
  if (family === 'text') return [...TEXT_OPERATORS]
  if (family === 'boolean') return [...BOOLEAN_OPERATORS]
  return [...ORDERED_OPERATORS]
}

export function normalizeConditionTree(tree) {
  if (!tree?.groups?.length) return null
  const groups = tree.groups.map(group => ({
    connector: group?.connector === 'OR' ? 'OR' : 'AND',
    conditions: (group?.conditions || []).map(condition => ({
      columnName: String(condition?.columnName || '').trim().toLowerCase(),
      operator: condition?.operator || 'EQ',
      values: Array.isArray(condition?.values)
        ? condition.values.map(value => String(value ?? ''))
        : [],
    })).filter(condition => condition.columnName
      || condition.values.some(value => value.trim())),
  })).filter(group => group.conditions.length)
  if (!groups.length) return null
  return {
    connector: tree.connector === 'OR' ? 'OR' : 'AND',
    groups,
  }
}

const expectedValueCount = operator => {
  if (['IS_NULL', 'IS_NOT_NULL'].includes(operator)) return 0
  if (operator === 'BETWEEN') return 2
  if (operator === 'IN') return -1
  return 1
}

export function validateScopeDraft(tree, compareLimit, columns = []) {
  const normalized = normalizeConditionTree(tree)
  const byName = new Map(columns.map(column => [column.columnName.toLowerCase(), column]))
  const errors = []
  normalized?.groups.forEach((group, groupIndex) => {
    if (!group.conditions.length) {
      errors.push({ path: `whereCondition.groups[${groupIndex}]`, reason: '条件组至少包含一个条件' })
    }
    group.conditions.forEach((condition, conditionIndex) => {
      const path = `whereCondition.groups[${groupIndex}].conditions[${conditionIndex}]`
      const column = byName.get(condition.columnName)
      if (!column) errors.push({ path, reason: `条件字段 ${condition.columnName || '-'} 在 BASE 母库中不存在` })
      if (column && !operatorsForDataType(column.dataType).includes(condition.operator)) {
        errors.push({ path, reason: `运算符 ${condition.operator} 不适用于该字段类型` })
      }
      const expected = expectedValueCount(condition.operator)
      const validCount = expected < 0 ? condition.values.length > 0 : condition.values.length === expected
      if (!validCount || (expected !== 0 && condition.values.some(value => !String(value).trim()))) {
        errors.push({ path, reason: condition.operator === 'BETWEEN'
          ? 'BETWEEN 必须填写两个条件值'
          : condition.operator === 'IN' ? 'IN 至少填写一个条件值' : '请填写完整条件值' })
      }
      if (column && expected !== 0) {
        condition.values.forEach((value, valueIndex) => {
          if (String(value).trim() && !valueMatchesType(value, column.dataType)) {
            errors.push({ path: `${path}.values[${valueIndex}]`, reason: '条件值与字段类型不匹配' })
          }
        })
      }
    })
  })
  if (compareLimit !== null && compareLimit !== undefined && compareLimit !== '') {
    const numeric = Number(compareLimit)
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 10000000) {
      errors.push({ path: 'compareLimit', reason: '比对条数必须在 1～10000000 之间' })
    }
  }
  return errors
}

const quote = value => `'${String(value).replaceAll("'", "''")}'`

const literal = (value, column) => {
  const family = typeFamily(column?.dataType)
  const normalized = String(value).trim()
  if (family === 'number') return normalized
  if (family === 'boolean') return normalized.toUpperCase()
  if (family === 'timestamp') return quote(normalized.replace('T', ' '))
  return quote(value)
}

const conditionSql = (condition, column) => {
  const name = column?.columnName || condition.columnName
  const values = condition.values || []
  return {
    EQ: `${name} = ${literal(values[0], column)}`,
    NE: `${name} <> ${literal(values[0], column)}`,
    GT: `${name} > ${literal(values[0], column)}`,
    GE: `${name} >= ${literal(values[0], column)}`,
    LT: `${name} < ${literal(values[0], column)}`,
    LE: `${name} <= ${literal(values[0], column)}`,
    LIKE: `${name} like ${literal(values[0], column)}`,
    IN: `${name} in (${values.map(value => literal(value, column)).join(', ')})`,
    BETWEEN: `${name} between ${literal(values[0], column)} and ${literal(values[1], column)}`,
    IS_NULL: `${name} is null`,
    IS_NOT_NULL: `${name} is not null`,
  }[condition.operator] || ''
}

export function buildScopePreview(tree, columns = [], compareLimit, primaryKeyColumns = []) {
  const normalized = normalizeConditionTree(tree)
  const byName = new Map(columns.map(column => [column.columnName.toLowerCase(), column]))
  const lines = []
  if (normalized) {
    const singleCondition = normalized.groups.length === 1
      && normalized.groups[0].conditions.length === 1
    const groups = normalized.groups.map(group => {
      const sql = group.conditions
        .map(condition => conditionSql(condition, byName.get(condition.columnName)))
        .join(` ${group.connector.toLowerCase()} `)
      return singleCondition ? sql : `(${sql})`
    })
    lines.push(`where ${groups.join(` ${normalized.connector.toLowerCase()} `)}`)
  }
  if (compareLimit !== null && compareLimit !== undefined && compareLimit !== '') {
    if (primaryKeyColumns.length) lines.push(`order by ${primaryKeyColumns.join(',')}`)
    lines.push(`limit ${compareLimit}`)
  }
  return lines.join('\n') || '全表比对'
}
