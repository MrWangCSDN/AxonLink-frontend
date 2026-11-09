import { request } from './index.js'

const PREFIX = '/ai/parallel-replay/issues/reopens'
const id = encodeURIComponent
const read = (path, params = {}) => {
  const query = Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)
    .map(([key, value]) => `${id(key)}=${id(value)}`).join('&')
  return request(`${PREFIX}${path}${query ? `?${query}` : ''}`)
}
const write = (path, payload, method = 'POST') => request(`${PREFIX}${path}`, { method, body: JSON.stringify(payload) })

export const getReopenPermissions = () => read('/permissions')
export const getReopenFilters = params => read('/filters', params)
export const searchReopenDevelopers = (keyword = '', limit = 20) => read('/developers', { keyword, limit })
export const listReopenEvents = params => read('/events', params)
export const getReopenEvent = eventId => read(`/events/${id(eventId)}`)
export const getReopenHistory = (eventId, params) => read(`/events/${id(eventId)}/history`, params)
export const getReopenIssueCounts = issueKeys => write('/issue-counts', { issueKeys })
export const getReopenStatistics = params => read('/statistics', params)
export const listReopenAppeals = params => read('/appeals', params)
export const getReopenAppeal = appealId => read(`/appeals/${id(appealId)}`)
export const createReopenAppeal = payload => write('/appeals', payload)
export const decideReopenAppeal = (appealId, payload) => write(`/appeals/${id(appealId)}/decisions`, payload)
export const withdrawReopenAppeal = (appealId, payload) => write(`/appeals/${id(appealId)}/withdraw`, payload)
export const reassignReopenAppeal = (appealId, payload) => write(`/appeals/${id(appealId)}/reassign`, payload)
export const assignReopenEvent = (eventId, payload) => write(`/events/${id(eventId)}/assign`, payload)
export const getReopenPolicies = () => read('/policies')
export const saveReopenPolicy = (domain, payload) => write(`/policies/${id(domain)}`, payload, 'PUT')
