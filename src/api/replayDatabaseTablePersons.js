import { request } from './index.js'

const PREFIX = '/ai/parallel-replay/database-table-persons'

export function listReplayDatabaseTablePersons(params = {}) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  query.set('limit', String(params.limit ?? 50))
  query.set('offset', String(params.offset ?? 0))
  return request(`${PREFIX}?${query}`)
}

export async function importReplayDatabaseTablePersons(file, token) {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(`/api${PREFIX}/import`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-DII-Trigger-Token': token || '' },
    body: form,
  })
  const json = await response.json().catch(() => ({}))
  if (response.ok && json?.code === 200) return json.data
  const error = new Error(json?.message || `HTTP ${response.status}`)
  error.data = json?.data
  throw error
}

export async function exportReplayDatabaseTablePersons(keyword = '') {
  const response = await fetch(`/api${PREFIX}/export${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.blob()
}
