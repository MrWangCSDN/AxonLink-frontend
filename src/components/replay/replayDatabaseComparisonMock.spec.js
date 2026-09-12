import { describe, expect, it } from 'vitest'
import { getMockColumns, searchMockTables } from './replayDatabaseComparisonMock.js'

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
})
