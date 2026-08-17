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
  const normalizedParams = {
    ...params,
    limit: Math.min(Math.max(params.limit ?? 50, 1), 200),
  }
  const query = queryString(normalizedParams)

  return request(`${PREFIX}${query ? `?${query}` : ''}`)
}

export function getReplayIssueOptions() {
  return request(`${PREFIX}/options`)
}

export function getReplayIssueHeaderFilterOptions(params = {}) {
  const query = queryString(params)
  return request(`${PREFIX}/header-filter-options${query ? `?${query}` : ''}`)
}

export function getReplayIssueStats() {
  return request(`${PREFIX}/stats`)
}

export function getReplayIssueGroupSummaries() {
  return request(`${PREFIX}/stats/groups`)
}

export function getReplayIssuePersonRankings() {
  return request(`${PREFIX}/stats/person-ranking`)
}

export function getReplayImportRounds() {
  return request(`${PREFIX}/rounds`)
}

export function getReplayIssueRoundTracking(id) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/round-tracking`)
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

export async function importReplayIssues(file, token) {
  const formData = new FormData()
  formData.append('file', file)

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

export async function fullRefreshReplayIssues(file, token) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('confirm', 'FULL_REFRESH')

  const response = await fetch('/api/ai/parallel-replay/issues/full-refresh', {
    method: 'POST',
    headers: { 'X-DII-Trigger-Token': token || '' },
    body: formData,
  })
  const json = await response.json().catch(() => ({}))
  if (response.ok && json?.code === 200) return json.data

  const error = new Error(json?.message || `HTTP ${response.status}`)
  if (response.status === 401) error.code = 'TOKEN_INVALID'
  if (response.status === 409) error.code = 'IMPORT_BUSY'
  throw error
}
