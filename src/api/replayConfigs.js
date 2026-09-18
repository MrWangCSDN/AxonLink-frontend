import { request } from './index.js'

const PREFIX = '/ai/parallel-replay/config'

function queryString(params) {
  return Object.entries(params)
    .flatMap(([key, value]) => {
      if (value === undefined || value === null || value === '') return []
      return [`${encodeURIComponent(key)}=${encodeURIComponent(value)}`]
    })
    .join('&')
}

/** 分页查询某类回放配置。 */
export function listReplayConfigs(type, params = {}) {
  const query = queryString(params)
  return request(`${PREFIX}/${type}${query ? `?${query}` : ''}`)
}

/** 新增某类回放配置。 */
export function createReplayConfig(type, body) {
  return request(`${PREFIX}/${type}`, { method: 'POST', body: JSON.stringify(body) })
}

/** 修改某类回放配置（body 必须含 version）。 */
export function updateReplayConfig(type, id, body) {
  return request(`${PREFIX}/${type}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

/** 审核通过某类回放配置（需 version 乐观锁）。 */
export function reviewReplayConfig(type, id, version) {
  return request(`${PREFIX}/${type}/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  })
}

/** 批量新增（1~3 条，逐条独立填写）；items 为各类型的 CreateRequest。 */
export function batchCreateReplayConfigs(type, items) {
  return request(`${PREFIX}/${type}/batch-create`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}

/** 批量审核，items 形如 [{ id, version }]，最多 100 条；能审的通过、其余跳过。 */
export function batchReviewReplayConfigs(type, items) {
  return request(`${PREFIX}/${type}/batch-review`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}

/** 单条物理删除（携带 version 乐观锁）。 */
export function deleteReplayConfig(type, id, version) {
  return request(`${PREFIX}/${type}/${encodeURIComponent(id)}?version=${encodeURIComponent(version)}`, {
    method: 'DELETE',
  })
}

/** 勾选批量删除，items 形如 [{ id, version }]，最多 100 条。 */
export function batchDeleteReplayConfigs(type, items) {
  return request(`${PREFIX}/${type}/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}

/** 查询某条配置的操作历史。 */
export function listReplayConfigOperations(type, id, params = {}) {
  const query = queryString(params)
  return request(`${PREFIX}/${type}/${encodeURIComponent(id)}/operations${query ? `?${query}` : ''}`)
}
