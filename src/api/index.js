/**
 * API 请求封装
 * 生产环境：请求 /api（Spring Boot 处理）
 * 开发环境：可通过 vite.config.js proxy 转发到后端
 */

const BASE = '/api'

// 导出供其他 api/ 子模块复用（如 api/daoIndex.js）
export async function request(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  const json = await res.json()
  if (json.code !== 200) throw new Error(json.message || '请求失败')
  return json.data
}

// 导出供其他 api/ 子模块复用
export async function download(url, fallbackFileName) {
  const res = await fetch(BASE + url)
  if (!res.ok) {
    const message = await res.text().catch(() => '')
    throw new Error(message || `HTTP ${res.status}: ${url}`)
  }

  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') || ''
  const fileName = parseDownloadFileName(disposition) || fallbackFileName
  triggerBrowserDownload(blob, fileName)
  return { fileName }
}

function parseDownloadFileName(contentDisposition) {
  if (!contentDisposition) return ''
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }
  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
  return plainMatch?.[1] || ''
}

function triggerBrowserDownload(blob, fileName) {
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName || 'impact-export.xlsx'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)
}

/** 获取系统统计 */
export function getSystemStats() {
  return request('/system/stats')
}

/** 获取最近一次全量拉取+编译状态 */
export function getBuildSyncStatus() {
  return request('/system/build-sync-status')
}

// ── flowtran 数据驱动接口（替代 getDomains / getTransactions） ──────────────

/**
 * 获取所有业务领域列表（来自 Neo4j 交易图，实时查询）
 */
export function getFlowtranDomains() {
  return request('/flowtran/domains')
}

/**
 * 分页查询某领域下的交易列表
 * @param {string} domainKey   领域标识，如 deposit
 * @param {number} page        页码，从 1 开始
 * @param {number} size        每页条数
 * @param {string} keyword     模糊搜索关键词（可选）
 */
export function getFlowtranTransactions(domainKey, page = 1, size = 20, keyword = '') {
  const kw = keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''
  return request(`/flowtran/domains/${domainKey}/transactions?page=${page}&size=${size}${kw}`)
}

/**
 * 查询某交易的完整调用链路（交易编排 + Neo4j 调用关系 + 元数据缓存富化）
 * @param {string} txId  flowtran.id，如 TC0033
 */
export function getFlowtranChain(txId) {
  return request(`/flowtran/transactions/${encodeURIComponent(txId)}/chain`)
}

/**
 * 查询指定表的全领域影响分析图
 * @param {string} tableId 表英文名，如 DpAccQuery
 */
export function getFlowtranTableImpact(tableId) {
  return request(`/flowtran/impact/table/${encodeURIComponent(tableId)}`)
}

/**
 * 查询指定构件方法的全领域影响分析图
 * @param {string} componentId 构件方法标识，如 XxxSvtp.yyy
 */
export function getFlowtranComponentImpact(componentId) {
  return request(`/flowtran/impact/component/${encodeURIComponent(componentId)}`)
}

/**
 * 查询指定服务方法的全领域影响分析图
 * @param {string} serviceId 服务方法标识，如 XxxSvtp.yyy
 */
export function getFlowtranServiceImpact(serviceId) {
  return request(`/flowtran/impact/service/${encodeURIComponent(serviceId)}`)
}

/**
 * 查询影响分析侧边栏统计
 */
export function getFlowtranImpactStats() {
  return request('/flowtran/impact/stats')
}

/**
 * 导出当前影响分析结果 Excel
 * @param {'table'|'component'|'service'} mode
 * @param {string} id
 */
export function exportFlowtranImpactCurrent(mode, id) {
  return download(
    `/flowtran/impact/export/${encodeURIComponent(mode)}/${encodeURIComponent(id)}`,
    `impact-${mode}-${id}.xlsx`,
  )
}

/**
 * 导出当前模式全部影响分析结果 Excel
 * @param {'table'|'component'|'service'} mode
 */
export function exportFlowtranImpactAll(mode) {
  return download(
    `/flowtran/impact/export/${encodeURIComponent(mode)}/all`,
    `impact-${mode}-all.xlsx`,
  )
}

/**
 * 查询全量构件方法目录
 * @param {string} keyword 构件方法编码/中文名关键词（可选）
 */
export function getFlowtranComponentCatalog(keyword = '') {
  const kw = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
  return request(`/flowtran/impact/components${kw}`)
}

/**
 * 查询全量服务方法目录
 * @param {string} keyword 服务方法编码/中文名关键词（可选）
 */
export function getFlowtranServiceCatalog(keyword = '') {
  const kw = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
  return request(`/flowtran/impact/services${kw}`)
}

/**
 * 查询 Neo4j 全量表目录
 * @param {string} keyword 表英文名/中文名关键词（可选）
 */
export function getNeo4jTableCatalog(keyword = '') {
  const kw = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
  return request(`/neo4j/tables/catalog${kw}`)
}

/**
 * 基于交易链路触发 AI 解读
 * @param {string} txId 交易号
 * @param {object} payload 分析请求
 */
export function analyzeFlowtranTransaction(txId, payload = {}) {
  return request(`/ai/transactions/${encodeURIComponent(txId)}/analysis`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * 对当前代码片段发起流式智能解读
 * @param {object} payload
 * @param {object} handlers
 */
export async function streamCodeExplanation(payload = {}, handlers = {}) {
  try {
    const res = await fetch(`${BASE}/ai/code-explain/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/x-ndjson',
      },
      body: JSON.stringify(payload),
      signal: handlers.signal,
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: /ai/code-explain/stream`)
    }
    if (!res.body) {
      throw new Error('流式响应不可用')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    const emit = (event) => {
      if (!event || typeof event !== 'object') return
      if (event.type === 'start') handlers.onStart?.(event)
      else if (event.type === 'delta') handlers.onDelta?.(event)
      else if (event.type === 'done') handlers.onDone?.(event)
      else if (event.type === 'error') handlers.onError?.(event)
    }

    const parseLine = (line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      const event = JSON.parse(trimmed)
      emit(event)
    }

    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)
        parseLine(line)
        newlineIndex = buffer.indexOf('\n')
      }

      if (done) {
        if (buffer.trim()) {
          parseLine(buffer)
        }
        break
      }
    }
  } catch (error) {
    if (handlers.signal?.aborted) {
      throw error
    }
    const message = normalizeStreamError(error)
    handlers.onError?.({ type: 'error', message })
    throw new Error(message)
  }
}

function normalizeStreamError(error) {
  const rawMessage = String(error?.message || '').trim()
  if (!rawMessage) {
    return '智能解读网络连接异常，请稍后重试'
  }
  const lower = rawMessage.toLowerCase()
  if (lower === 'failed to fetch' || lower === 'network error' || lower.includes('load failed')) {
    return '智能解读网络连接异常，可能是流式响应超时或模型服务暂时不可用'
  }
  return rawMessage
}

/**
 * 热重载元数据缓存（不重启服务）
 */
export function refreshFlowtranCache() {
  return request('/flowtran/cache/refresh', { method: 'POST' })
}

/**
 * 查询元数据缓存当前统计
 */
export function getFlowtranCacheStats() {
  return request('/flowtran/cache/stats')
}

/**
 * 查询当前激活的数据源环境
 */
export function getFlowtranEnv() {
  return request('/flowtran/env')
}
