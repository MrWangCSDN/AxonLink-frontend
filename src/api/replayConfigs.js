import { download, request } from './index.js'

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

/** 领域筛选项（全部领域，取自全量交易人员清单）。 */
export function listReplayConfigDomains() {
  return request(`${PREFIX}/domains`)
}

/** 导出已审核的忽略清单（固定四个 sheet）。 */
export function exportReviewedReplayConfigs() {
  return download(`${PREFIX}/export`, '忽略清单.xlsx')
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

const MESSAGE_SEQUENCE_TYPE = 'message-sequence-ignores'

export function createMessageSequenceIgnores(body) {
  return createReplayConfig(MESSAGE_SEQUENCE_TYPE, body)
}

export function updateMessageSequenceIgnore(id, body) {
  return updateReplayConfig(MESSAGE_SEQUENCE_TYPE, id, body)
}

export function reviewMessageSequenceIgnore(id) {
  return request(`${PREFIX}/${MESSAGE_SEQUENCE_TYPE}/${encodeURIComponent(id)}/review`, { method: 'POST' })
}

export function batchReviewMessageSequenceIgnores(ids) {
  return request(`${PREFIX}/${MESSAGE_SEQUENCE_TYPE}/batch-review`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function deleteMessageSequenceIgnore(id) {
  return request(`${PREFIX}/${MESSAGE_SEQUENCE_TYPE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function batchDeleteMessageSequenceIgnores(ids) {
  return request(`${PREFIX}/${MESSAGE_SEQUENCE_TYPE}/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function exportReviewedMessageSequenceIgnores() {
  return download(`${PREFIX}/${MESSAGE_SEQUENCE_TYPE}/export`, '流水号忽略.txt')
}

const ONE_SIDE_ERROR_CODE_TYPE = 'one-side-error-code-ignores'

export function createOneSideErrorCodeIgnores(body) {
  return createReplayConfig(ONE_SIDE_ERROR_CODE_TYPE, body)
}

export function updateOneSideErrorCodeIgnore(id, body) {
  return updateReplayConfig(ONE_SIDE_ERROR_CODE_TYPE, id, body)
}

export function reviewOneSideErrorCodeIgnore(id) {
  return request(`${PREFIX}/${ONE_SIDE_ERROR_CODE_TYPE}/${encodeURIComponent(id)}/review`, { method: 'POST' })
}

export function batchReviewOneSideErrorCodeIgnores(ids) {
  return request(`${PREFIX}/${ONE_SIDE_ERROR_CODE_TYPE}/batch-review`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function deleteOneSideErrorCodeIgnore(id) {
  return request(`${PREFIX}/${ONE_SIDE_ERROR_CODE_TYPE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function batchDeleteOneSideErrorCodeIgnores(ids) {
  return request(`${PREFIX}/${ONE_SIDE_ERROR_CODE_TYPE}/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function exportReviewedOneSideErrorCodeIgnores() {
  return download(`${PREFIX}/${ONE_SIDE_ERROR_CODE_TYPE}/export`, '单边失败错误码忽略.txt')
}
