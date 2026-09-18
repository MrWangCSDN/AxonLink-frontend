import { describe, expect, it } from 'vitest'
import { getMockColumns, mockScopeExamples, searchMockTables } from './replayDatabaseComparisonMock.js'

describe('replay database comparison metadata mock', () => {
  const registrations = [{
    id: 12,
    version: 3,
    tableName: 'kdpa_cb_acct_fzn_cntl_inf',
  }]

  it('searches tables by English or Chinese name and exposes registration state', () => {
    expect(searchMockTables('', registrations)).toEqual([])
    expect(searchMockTables('冻结', registrations)[0]).toMatchObject({
      tableName: 'kdpa_cb_acct_fzn_cntl_inf',
      registrationStatus: 'ACTIVE',
      registrationId: 12,
      registrationVersion: 3,
    })
    expect(searchMockTables('customer', registrations).some(table => table.registrationStatus === 'UNREGISTERED')).toBe(true)
  })

  it('returns ordered columns with data type and primary-key metadata', () => {
    const columns = getMockColumns('kdpa_cb_acct_fzn_cntl_inf')

    expect(columns.length).toBeGreaterThanOrEqual(12)
    expect(columns[0]).toMatchObject({
      columnName: 'fzn_cntl_id',
      dataType: 'VARCHAR(40)',
      ordinalPosition: 1,
      primaryKey: true,
    })
    expect(columns.map(column => column.ordinalPosition)).toEqual(
      [...columns].map(column => column.ordinalPosition).sort((left, right) => left - right),
    )
  })

  it('exposes an unregistered table whose metadata has fields but no primary key', () => {
    expect(searchMockTables('no_primary_key_new', registrations)[0]).toMatchObject({
      tableName: 'no_primary_key_new',
      registrationStatus: 'UNREGISTERED',
    })
    const columns = getMockColumns('no_primary_key_new')
    expect(columns.length).toBeGreaterThan(0)
    expect(columns.some(column => column.primaryKey)).toBe(false)
  })

  it('exposes a registered table after its BASE primary key has been removed', () => {
    const registeredWithoutPrimaryKey = {
      id: 88, version: 4, tableName: 'no_primary_key_registered',
    }
    expect(searchMockTables('no_primary_key_registered', [registeredWithoutPrimaryKey])[0]).toMatchObject({
      tableName: 'no_primary_key_registered',
      registrationStatus: 'ACTIVE',
      registrationId: 88,
      registrationVersion: 4,
    })
    const columns = getMockColumns('no_primary_key_registered')
    expect(columns.length).toBeGreaterThan(0)
    expect(columns.some(column => column.primaryKey)).toBe(false)
  })

  it('provides deterministic full, condition, limit and drift scope examples', () => {
    expect(Object.keys(mockScopeExamples)).toEqual([
      'fullTable', 'conditionOnly', 'limitOnly', 'conditionAndLimit', 'missingConditionField',
    ])
    expect(mockScopeExamples.conditionOnly.whereCondition).toBeTruthy()
    expect(mockScopeExamples.limitOnly.compareLimit).toBe(1000)
    expect(mockScopeExamples.missingConditionField.metadataValidation.missingConditionFieldNames)
      .toEqual(['legacy_status'])
  })
})
