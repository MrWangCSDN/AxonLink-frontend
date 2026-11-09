import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './replayDatabaseIssues.js'
import { request, download } from './index.js'
vi.mock('./index.js', () => ({ request: vi.fn(), download: vi.fn() }))
describe('database issue filter bodies', () => {
  beforeEach(() => vi.clearAllMocks())
  it('uses separate plan-date endpoints and preserves null and optimistic version',async()=>{
    await api.updateDatabaseIssuePlanDate(5,null,3)
    expect(request).toHaveBeenCalledWith('/ai/parallel-replay/database-issues/5/planned-completion-date',{method:'PATCH',body:JSON.stringify({plannedCompletionDate:null,version:3})})
    await api.getDatabaseIssuePlanDateChanges(5)
    expect(request).toHaveBeenLastCalledWith('/ai/parallel-replay/database-issues/5/planned-completion-date-changes')
  })
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
  it('loads the complete report batch catalog and downloads a whole batch without list criteria', async () => {
    await api.getDatabaseIssueReportOptions()
    expect(request).toHaveBeenCalledWith('/ai/parallel-replay/database-issues/report/options')
    await api.exportDatabaseIssueReport({ batchNo: ' DB20261001-01 ', offset: 200, domains: ['贷款组'], issueTypes: ['旧分类'] })
    expect(download).toHaveBeenCalledWith('/ai/parallel-replay/database-issues/report/export', '回放数据库问题汇总报表.xlsx', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchNo: 'DB20261001-01' }),
    })
  })
  it.each([undefined, {}, { batchNo: '' }, { batchNo: null }])('lets the backend select the latest business batch for %j', async params => {
    await api.exportDatabaseIssueReport(params)
    expect(JSON.parse(download.mock.calls[0][2].body)).toEqual({})
  })
  it('sends a second precision release time with the uploaded workbook', async () => {
    const file = new File(['x'], 'bd.xlsx')
    await api.importDatabaseIssues(file, 'DB20261015-01', '2026-10-14 12:00:01', 'test-token')
    expect(request.mock.calls[0][1].headers).toEqual({ 'X-DII-Trigger-Token': 'test-token' })
    const body = request.mock.calls[0][1].body
    expect(body.get('releaseAt')).toBe('2026-10-14 12:00:01')
    expect(body.get('batchNo')).toBe('DB20261015-01')
    expect(body.has('registrationVersionNo')).toBe(false)
  })
  it('includes the selected immutable registration version in the import form', async () => {
    const file = new File(['x'], 'bd.xlsx')
    await api.importDatabaseIssues(file, 'DB20261015-01', '2026-10-14 12:00:01', 'test-token', ' 20261105-100000 ')
    const [, options] = request.mock.calls[0]
    expect(options.body.get('file')).toBe(file)
    expect(options.body.get('registrationVersionNo')).toBe('20261105-100000')
    expect(options.headers).toEqual({ 'X-DII-Trigger-Token': 'test-token' })
  })
  it('reads the selected batch import binding with an encoded batch query', async () => {
    await api.getDatabaseIssueImportContext(' DB20261015-01&other=1 ')
    expect(request).toHaveBeenCalledWith('/ai/parallel-replay/database-issues/import-context?batchNo=DB20261015-01%26other%3D1')
  })
  it('posts header candidate search with the other active columns', async () => {
    const criteria = { field: 'tableName', keyword: 'koba_', domains: ['贷款组', '存款组'] }
    await api.getDatabaseIssueFilterOptions(criteria)
    expect(request).toHaveBeenCalledWith('/ai/parallel-replay/database-issues/filter-options', {method:'POST',body:JSON.stringify(criteria)})
  })
})
