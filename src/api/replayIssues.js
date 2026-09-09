import { download, request } from './index.js'

const PREFIX = '/ai/parallel-replay/issues'

function queryString(params) {
  return Object.entries(params).flatMap(([key, value]) => {
    if (value === undefined || value === null || value === '') return []
    const values = Array.isArray(value) ? value : [value]
    return values.map((item) => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`)
  }).join('&')
}

export function listReplayIssues(params = {}) {
  const { affectedTransactionCountOrder, ...query } = {
    ...params,
    limit: Math.min(Math.max(params.limit ?? 50, 1), 200),
  }
  return request(PREFIX, {
    method: 'POST',
    body: JSON.stringify({ query, affectedTransactionCountOrder }),
  })
}

export function getReplayIssueOptions() {
  return request(`${PREFIX}/options`)
}

export function getReplayIssueHeaderFilterOptions(params = {}) {
  const query = queryString(params)
  return request(`${PREFIX}/header-filter-options${query ? `?${query}` : ''}`)
}

export function getReplayIssueHeaderFilterOptionCounts(params = {}) {
  const { field, keyword, ...query } = params
  return request(`${PREFIX}/header-filter-option-counts`, {
    method: 'POST',
    body: JSON.stringify({ field, keyword, query }),
  })
}

export function getReplayIssueStats(params = {}) {
  const query = queryString(params)
  return request(`${PREFIX}/stats${query ? `?${query}` : ''}`)
}

export function getReplayCompletionDatePoints(params = {}) {
  const query = queryString(params)
  return request(`${PREFIX}/stats/planned-completion/date-points${query ? `?${query}` : ''}`)
}

export function getReplayCompletionDashboard(params = {}) {
  const query = queryString(params)
  return request(`${PREFIX}/stats/planned-completion${query ? `?${query}` : ''}`)
}

export function getReplayCompletionIssues(params = {}) {
  const query = queryString(params)
  return request(`${PREFIX}/stats/planned-completion/issues${query ? `?${query}` : ''}`)
}

export function getReplayIssueReviewPermissions() {
  return request(`${PREFIX}/review-permissions`)
}

export function getReplayIssuePlanDatePermissions() {
  return request(`${PREFIX}/plan-date-permissions`)
}

export function getReplayIssuePlanDateChanges(id) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/planned-completion-date-changes`)
}

export function getReplayIssueDomainPermissions() {
  return request(`${PREFIX}/issue-domain-permissions`)
}

export function updateReplayIssueDomain(id, issueDomain) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/issue-domain`, {
    method: 'PATCH',
    body: JSON.stringify({ issueDomain }),
  })
}

export function getReplayIssueDomainTransfers(id) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/issue-domain-transfers`)
}

export function updateReplayIssuePlannedCompletionDate(id, plannedCompletionDate) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/planned-completion-date`, {
    method: 'PATCH',
    body: JSON.stringify({ plannedCompletionDate }),
  })
}

export function approveReplayIssue(id) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/review/approve`, { method: 'POST' })
}

export function getReplayWeeklyTask() {
  return request(`${PREFIX}/weekly-task`)
}

export function replaceReplayWeeklyTask(batchNames = [], token = '') {
  return request(`${PREFIX}/weekly-task`, {
    method: 'PUT',
    headers: { 'X-DII-Trigger-Token': token || '' },
    body: JSON.stringify({ batchNames }),
  })
}

export function getReplayIssueGroupSummaries(params = {}) {
  const query = queryString(params)
  return request(`${PREFIX}/stats/groups${query ? `?${query}` : ''}`)
}

export function getReplayIssuePersonRankings(params = {}) {
  const query = queryString(params)
  return request(`${PREFIX}/stats/person-ranking${query ? `?${query}` : ''}`)
}

export function getReplayIssuePersonSchedule(params = {}) {
  const query = queryString(params)
  return request(`${PREFIX}/stats/person-ranking/schedule${query ? `?${query}` : ''}`)
}

export function getReplayImportRounds() {
  return request(`${PREFIX}/rounds`)
}

export function getReplayIssueRoundTracking(id) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/round-tracking`)
}

/** 列出可按需生成的日报批次（含同族上一批次和 canGenerate 状态）。 */
export function getReplayDailyReportBatches() {
  return request(`${PREFIX}/daily-report/batches`)
}

/** 实时从数据库生成并下载指定 batchNo 的日报 .xlsx。 */
export function downloadReplayDailyReport(batchNo) {
  const filename = `${batchNo}批次日报.xlsx`
  return download(`${PREFIX}/daily-report?batchNo=${encodeURIComponent(batchNo)}`, filename)
}

export function getReplayDailyReportMailConfig(batchNo) {
  return request(`${PREFIX}/daily-report/mail-config?batchNo=${encodeURIComponent(batchNo)}`)
}

export function sendReplayDailyReportMail(mail, token = '') {
  return request(`${PREFIX}/daily-report/mail-send`, {
    method: 'POST',
    headers: { 'X-DII-Trigger-Token': token || '' },
    body: JSON.stringify(mail || {}),
  })
}

export function getReplayWeeklyReportOptions() {
  return request(`${PREFIX}/weekly-report/options`)
}

export function downloadReplayWeeklyReport(startBatchNo, endBatchNo) {
  const query = `startBatchNo=${encodeURIComponent(startBatchNo)}&endBatchNo=${encodeURIComponent(endBatchNo)}`
  return download(`${PREFIX}/weekly-report?${query}`, `${endBatchNo}周报.xlsx`)
}

export function getReplayWeeklyReportMailConfig(startBatchNo, endBatchNo) {
  const query = `startBatchNo=${encodeURIComponent(startBatchNo)}&endBatchNo=${encodeURIComponent(endBatchNo)}`
  return request(`${PREFIX}/weekly-report/mail-config?${query}`)
}

export function sendReplayWeeklyReportMail(mail, token = '') {
  return request(`${PREFIX}/weekly-report/mail-send`, {
    method: 'POST',
    headers: { 'X-DII-Trigger-Token': token || '' },
    body: JSON.stringify(mail || {}),
  })
}

export function exportReplayIssues(params = {}) {
  const query = queryString(params)
  return download(`${PREFIX}/export${query ? `?${query}` : ''}`, '回放问题清单.xlsx')
}

export function updateReplayIssue(id, payload) {
  return request(`${PREFIX}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getReplayIssueMailStatus(id) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/mail-status`)
}

export function sendReplayIssueMail(id, recipientEmails = []) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/mail-send`, {
    method: 'POST',
    body: JSON.stringify({ recipientEmails }),
  })
}

export function searchReplayIssueUsers(keyword = '', limit = 20) {
  return request(`${PREFIX}/users?keyword=${encodeURIComponent(keyword)}&limit=${Math.min(Math.max(limit, 1), 50)}`)
}

export function getReplayIssueTracking(id) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/tracking?limit=200`)
}

export async function importReplayIssues(file, token, replayType = 'QUERY') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('replayType', replayType || 'QUERY')

  const response = await fetch('/api/ai/parallel-replay/issues/import', {
    method: 'POST',
    headers: { 'X-DII-Trigger-Token': token || '' },
    body: formData,
  })
  const json = await response.json().catch(() => ({}))

  if (response.ok && json?.code === 200) {
    return json.data
  }

  const error = new Error(json?.message || `HTTP ${response.status}`)
  if (response.status === 401) error.code = 'TOKEN_INVALID'
  if (response.status === 409) error.code = 'IMPORT_BUSY'
  throw error
}
