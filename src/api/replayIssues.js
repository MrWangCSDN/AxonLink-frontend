import { request } from './index.js'

const PREFIX = '/ai/parallel-replay/issues'

export function listReplayIssues(params = {}) {
  const query = Object.entries(params)
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
