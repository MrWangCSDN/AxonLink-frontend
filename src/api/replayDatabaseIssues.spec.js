import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './replayDatabaseIssues.js'
import { request, download } from './index.js'
vi.mock('./index.js', () => ({ request: vi.fn(), download: vi.fn() }))
describe('database issue filter bodies', () => {
  beforeEach(() => vi.clearAllMocks())
  it('preserves arrays, commas and blanks in a body for list and export without growing the URL', async () => {
    const criteria = { owners: ['张三,李四', ''], issueIds: Array.from({length:500},(_,i)=>`long_table_name_${i}-some_long_field_name`), offset: 0, differenceCountOrder: 'ASC' }
    await api.listDatabaseIssues(criteria)
    await api.exportDatabaseIssues(criteria)
    expect(request.mock.calls[0][0]).toBe('/ai/parallel-replay/database-issues')
    expect(request.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(criteria)
    expect(download.mock.calls[0][0]).toBe('/ai/parallel-replay/database-issues/export')
    expect(download.mock.calls[0][2]).toMatchObject({method:'POST',headers:{'Content-Type':'application/json'}})
    expect(JSON.parse(download.mock.calls[0][2].body)).toEqual(criteria)
  })
  it('sends a second precision release time with the uploaded workbook', async () => {
    const file = new File(['x'], 'bd.xlsx')
    await api.importDatabaseIssues(file, 'DB20261015-01', '2026-10-14 12:00:01')
    const body = request.mock.calls[0][1].body
    expect(body.get('releaseAt')).toBe('2026-10-14 12:00:01')
    expect(body.get('batchNo')).toBe('DB20261015-01')
  })
  it('posts header candidate search with the other active columns', async () => {
    const criteria = { field: 'tableName', keyword: 'koba_', domains: ['贷款组', '存款组'] }
    await api.getDatabaseIssueFilterOptions(criteria)
    expect(request).toHaveBeenCalledWith('/ai/parallel-replay/database-issues/filter-options', {method:'POST',body:JSON.stringify(criteria)})
  })
})
