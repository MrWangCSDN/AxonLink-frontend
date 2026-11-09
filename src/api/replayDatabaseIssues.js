import { download, request } from './index.js'
const PREFIX = '/ai/parallel-replay/database-issues'
const filterBody = params => ({ method: 'POST', body: JSON.stringify(params || {}) })
export const listDatabaseIssues = params => request(PREFIX, filterBody(params))
export const getDatabaseIssueOptions = () => request(`${PREFIX}/options`)
export const getDatabaseIssueFilterOptions = params => request(`${PREFIX}/filter-options`, filterBody(params))
export function importDatabaseIssues(file, batchNo, releaseAt, token, registrationVersionNo) {
  const body = new FormData()
  body.append('file', file)
  if (batchNo?.trim()) body.append('batchNo', batchNo.trim())
  if (releaseAt != null) body.append('releaseAt', releaseAt)
  if (registrationVersionNo?.trim()) body.append('registrationVersionNo', registrationVersionNo.trim())
  return request(`${PREFIX}/import`, { method: 'POST', headers: { 'X-DII-Trigger-Token': token || '' }, body })
}
export const getDatabaseIssueImportContext = batchNo => request(`${PREFIX}/import-context?batchNo=${encodeURIComponent(String(batchNo || '').trim())}`)
export const updateDatabaseIssue = (id, body) => request(`${PREFIX}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) })
export const approveDatabaseIssue = (id, body) => request(`${PREFIX}/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify(body) })
export const getDatabaseIssueTracking = id => request(`${PREFIX}/${encodeURIComponent(id)}/tracking`)
export const exportDatabaseIssues = params => download(`${PREFIX}/export`, '回放数据库问题清单.xlsx', { ...filterBody(params), headers: { 'Content-Type': 'application/json' } })

export const updateDatabaseIssuePlanDate = (id, plannedCompletionDate, version) => request(`${PREFIX}/${encodeURIComponent(id)}/planned-completion-date`, { method: 'PATCH', body: JSON.stringify({ plannedCompletionDate, version }) })
export const getDatabaseIssuePlanDateChanges = id => request(`${PREFIX}/${encodeURIComponent(id)}/planned-completion-date-changes`)

export const getDatabaseIssueReportOptions = () => request(`${PREFIX}/report/options`)
export function exportDatabaseIssueReport(params) {
  const batchNo = typeof params?.batchNo === 'string' ? params.batchNo.trim() : ''
  return download(`${PREFIX}/report/export`, '回放数据库问题汇总报表.xlsx', {
    ...filterBody(batchNo ? { batchNo } : {}), headers: { 'Content-Type': 'application/json' },
  })
}
