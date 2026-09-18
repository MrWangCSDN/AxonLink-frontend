import { describe, expect, it } from 'vitest'
import {
  buildScopePreview,
  emptyConditionTree,
  normalizeConditionTree,
  operatorsForDataType,
  validateScopeDraft,
} from './replayDatabaseComparisonScope.js'

const columns = [
  { columnName: 'status', columnComment: '状态', dataType: 'character varying' },
  { columnName: 'amount', columnComment: '金额', dataType: 'numeric' },
  { columnName: 'biz_date', columnComment: '业务日期', dataType: 'date' },
  { columnName: 'created_at', columnComment: '创建时间', dataType: 'timestamp' },
  { columnName: 'enabled', columnComment: '启用', dataType: 'boolean' },
]

describe('replayDatabaseComparisonScope', () => {
  it('normalizes the two-level tree and builds a deterministic preview', () => {
    const tree = {
      connector: 'AND',
      groups: [{
        connector: 'OR',
        conditions: [
          { columnName: 'STATUS', operator: 'EQ', values: ['1'] },
          { columnName: 'status', operator: 'EQ', values: ['2'] },
        ],
      }],
    }

    expect(normalizeConditionTree(tree).groups[0].conditions[0].columnName).toBe('status')
    expect(buildScopePreview(tree, columns, 1000, ['acct_no']))
      .toBe("where (status = '1' or status = '2')\norder by acct_no\nlimit 1000")
  })

  it('omits redundant parentheses for a single condition', () => {
    const tree = {
      connector: 'AND',
      groups: [{
        connector: 'OR',
        conditions: [{ columnName: 'status', operator: 'EQ', values: ['1'] }],
      }],
    }

    expect(buildScopePreview(tree, columns, null, []))
      .toBe("where status = '1'")
  })

  it('returns data-type operators and every draft error', () => {
    expect(operatorsForDataType('numeric')).toContain('BETWEEN')
    expect(operatorsForDataType('character varying')).not.toContain('GT')
    const errors = validateScopeDraft({
      connector: 'AND',
      groups: [{ connector: 'AND', conditions: [
        { columnName: 'legacy_status', operator: 'EQ', values: [] },
      ] }],
    }, 10000001, columns)

    expect(errors.map(error => error.path)).toEqual([
      'whereCondition.groups[0].conditions[0]',
      'whereCondition.groups[0].conditions[0]',
      'compareLimit',
    ])
  })

  it('creates an empty two-level condition tree', () => {
    expect(emptyConditionTree()).toEqual({ connector: 'AND', groups: [] })
  })

  it('ignores untouched optional rows but still validates selected fields without values', () => {
    const tree = {
      connector: 'OR',
      groups: [
        { connector: 'AND', conditions: [{ columnName: '', operator: 'EQ', values: [''] }] },
        { connector: 'AND', conditions: [{ columnName: 'status', operator: 'EQ', values: [''] }] },
      ],
    }

    const normalized = normalizeConditionTree(tree)
    expect(normalized.groups).toHaveLength(1)
    expect(normalized.groups[0].conditions[0].columnName).toBe('status')
    expect(validateScopeDraft(tree, null, columns)).toEqual([{
      path: 'whereCondition.groups[0].conditions[0]',
      reason: '请填写完整条件值',
    }])
  })

  it('formats literals from mother-database field types', () => {
    const tree = {
      connector: 'AND',
      groups: [{ connector: 'AND', conditions: [
        { columnName: 'status', operator: 'IN', values: ['12', '2'] },
        { columnName: 'amount', operator: 'IN', values: ['12', '2.50'] },
        { columnName: 'biz_date', operator: 'EQ', values: ['2026-09-17'] },
        { columnName: 'created_at', operator: 'EQ', values: ['2026-09-17T10:11:12'] },
        { columnName: 'enabled', operator: 'IN', values: ['true', 'FALSE'] },
      ] }],
    }

    expect(buildScopePreview(tree, columns, null, [])).toBe(
      "where (status in ('12', '2') and amount in (12, 2.50)"
      + " and biz_date = '2026-09-17' and created_at = '2026-09-17 10:11:12'"
      + ' and enabled in (TRUE, FALSE))',
    )
  })

  it('rejects values that do not match the selected field type', () => {
    const tree = {
      connector: 'AND',
      groups: [{ connector: 'AND', conditions: [
        { columnName: 'amount', operator: 'EQ', values: ['abc'] },
        { columnName: 'biz_date', operator: 'EQ', values: ['2026-02-30'] },
        { columnName: 'created_at', operator: 'EQ', values: ['2026-09-17 25:00:00'] },
        { columnName: 'enabled', operator: 'EQ', values: ['yes'] },
      ] }],
    }

    expect(validateScopeDraft(tree, null, columns).map(error => error.path)).toEqual([
      'whereCondition.groups[0].conditions[0].values[0]',
      'whereCondition.groups[0].conditions[1].values[0]',
      'whereCondition.groups[0].conditions[2].values[0]',
      'whereCondition.groups[0].conditions[3].values[0]',
    ])
  })
})
