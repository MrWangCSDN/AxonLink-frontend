import { request } from './index.js'

const PREFIX = '/ai/parallel-replay/issues'

export function listReplayIssues(params = {}) {
  const normalizedParams = {
    ...params,
    limit: Math.min(Math.max(params.limit ?? 50, 1), 200),
  }
  const query = Object.entries(normalizedParams)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

  return request(`${PREFIX}${query ? `?${query}` : ''}`)
}

export function getReplayIssueOptions() {
  return request(`${PREFIX}/options`)
}

export function getReplayIssueStats() {
  return request(`${PREFIX}/stats`)
}

export function updateReplayIssue(id, payload) {
  return request(`${PREFIX}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
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
