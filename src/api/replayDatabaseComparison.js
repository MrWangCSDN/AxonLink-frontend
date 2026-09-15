import { download, request } from './index.js'

const PREFIX = '/ai/parallel-replay/database-comparison-fields'

const json = (method, body) => ({
  method,
  body: JSON.stringify(body || {}),
})

const query = (params = {}) => {
  const value = Object.entries(params)
    .filter(([, item]) => item !== undefined && item !== null && item !== '')
    .map(([key, item]) => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`)
    .join('&')
  return value ? `?${value}` : ''
}

export function searchRegistrations(criteria = {}) {
  return request(`${PREFIX}/search`, json('POST', criteria))
}

export function loadRegistration(id) {
  return request(`${PREFIX}/${encodeURIComponent(id)}`)
}

export function loadHeaderFilterOptions(criteria = {}) {
  return request(`${PREFIX}/header-filter-options`, json('POST', criteria))
}

export function searchBaseTables(keyword, limit = 20) {
  return request(`${PREFIX}/metadata/tables${query({ keyword, limit })}`)
}

export function loadBaseColumns(tableName, keyword = '') {
  return request(`${PREFIX}/metadata/tables/${encodeURIComponent(tableName)}/columns${query({ keyword })}`)
}

export function synchronizePrimaryKeys() {
  return request(`${PREFIX}/metadata/primary-keys/sync`, json('POST'))
}

export function loadLatestVersion() {
  return request(`${PREFIX}/versions/latest`)
}

export function loadVersions(page = 0, size = 20) {
  return request(`${PREFIX}/versions${query({ page, size })}`)
}

export function searchVersionSnapshot(versionNo, criteria = {}) {
  return request(
    `${PREFIX}/versions/${encodeURIComponent(versionNo)}/search`,
    json('POST', criteria),
  )
}

export function loadVersionHeaderFilterOptions(versionNo, criteria = {}) {
  return request(
    `${PREFIX}/versions/${encodeURIComponent(versionNo)}/header-filter-options`,
    json('POST', criteria),
  )
}

export function loadVersionConfigScriptStatus(versionNo) {
  return request(`${PREFIX}/versions/${encodeURIComponent(versionNo)}/config-script`)
}

const configScriptFileName = versionNo => `replay-db-compare-config-${versionNo}.sql`

export function generateVersionConfigScript(versionNo) {
  return download(
    `${PREFIX}/versions/${encodeURIComponent(versionNo)}/config-script`,
    configScriptFileName(versionNo),
    { method: 'POST' },
  )
}

export function downloadVersionConfigScript(versionNo) {
  return download(
    `${PREFIX}/versions/${encodeURIComponent(versionNo)}/config-script/download`,
    configScriptFileName(versionNo),
  )
}

export async function generateVersion(token = '') {
  const response = await fetch(`/api${PREFIX}/versions/generate`, {
    method: 'POST',
    headers: { 'X-DII-Trigger-Token': token || '' },
  })
  let payload = null
  try {
    payload = await response.json()
  } catch (_) {
    payload = null
  }
  if (!response.ok || payload?.code !== 200) {
    const error = new Error(payload?.message || `HTTP ${response.status}`)
    error.code = payload?.data?.errorCode || payload?.errorCode || payload?.code || response.status
    error.data = payload?.data
    throw error
  }
  return payload.data
}

export function createRegistration(body) {
  return request(PREFIX, json('POST', body))
}

export function updateRegistration(id, body) {
  return request(`${PREFIX}/${encodeURIComponent(id)}`, json('PUT', body))
}

export function deleteRegistration(id, body) {
  return request(`${PREFIX}/${encodeURIComponent(id)}`, json('DELETE', body))
}

export function reregisterRegistration(id, body) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/reregister`, json('POST', body))
}

export function searchAudits(criteria = {}) {
  return request(`${PREFIX}/audits/search`, json('POST', criteria))
}

export function searchGroupedAudits(criteria = {}) {
  return request(`${PREFIX}/audits/grouped-search`, json('POST', criteria))
}

export function loadAuditDetails(eventId) {
  return request(`${PREFIX}/audits/${encodeURIComponent(eventId)}/details`)
}

export function loadRegistrationAudits(id, page = 0, size = 50) {
  return request(`${PREFIX}/${encodeURIComponent(id)}/audits${query({ page, size })}`)
}

export function loadOptions() {
  return request(`${PREFIX}/options`)
}

export async function importInitialExcel(file, token = '') {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(`/api${PREFIX}/import`, {
    method: 'POST',
    headers: { 'X-DII-Trigger-Token': token || '' },
    body: form,
  })
  let payload = null
  try {
    payload = await response.json()
  } catch (_) {
    payload = null
  }
  if (!response.ok || payload?.code !== 200) {
    const error = new Error(payload?.message || `HTTP ${response.status}`)
    error.code = payload?.errorCode || payload?.code || response.status
    error.data = payload?.data
    throw error
  }
  return payload.data
}
