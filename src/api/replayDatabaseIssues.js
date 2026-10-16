import { download, request } from './index.js'
const PREFIX = '/ai/parallel-replay/database-issues'
const filterBody = params => ({ method: 'POST', body: JSON.stringify(params || {}) })
export const listDatabaseIssues = params => request(PREFIX, filterBody(params))
export const getDatabaseIssueOptions = () => request(`${PREFIX}/options`)
export const getDatabaseIssueFilterOptions = params => request(`${PREFIX}/filter-options`, filterBody(params))
export function importDatabaseIssues(file, batchNo, releaseAt) { const body = new FormData(); body.append('file', file); if (batchNo?.trim()) body.append('batchNo', batchNo.trim()); if (releaseAt != null) body.append('releaseAt', releaseAt); return request(`${PREFIX}/import`, { method: 'POST', body }) }
export const updateDatabaseIssue = (id, body) => request(`${PREFIX}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) })
export const approveDatabaseIssue = (id, body) => request(`${PREFIX}/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify(body) })
export const getDatabaseIssueTracking = id => request(`${PREFIX}/${encodeURIComponent(id)}/tracking`)
export const exportDatabaseIssues = params => download(`${PREFIX}/export`, '回放数据库问题清单.xlsx', { ...filterBody(params), headers: { 'Content-Type': 'application/json' } })
