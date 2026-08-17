/**
 * API 请求封装
 * 生产环境：请求 /api（Spring Boot 处理）
 * 开发环境：可通过 vite.config.js proxy 转发到后端
 *
 * 鉴权拦截：
 * - 当响应 HTTP 401 或业务 code===401 时，认为是"未登录"
 * - 自动跳转 /login（携带 redirect 参数），且在 /login 页时不跳避免循环
 * - 异常仍向上抛出，调用方可按需 catch
 * - 仅 401 触发跳转，404 / 5xx / 普通 R.fail 业务错误不受影响
 */
import router from '../router/index.js'

const BASE = '/api'

/**
 * 自定义 HTTP 异常：携带 status、code 字段，便于 router guard 区分 401/404
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 0, url = '' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status   // HTTP 状态码（如 401/404/500）
    this.code = code       // 业务 code（ApiResult.code，如 200/401/500）
    this.url = url
  }
}

// 跳转到 /login 的内部工具：避免在 /login 页二次跳转造成循环
function redirectToLogin() {
  if (!router) return
  const current = router.currentRoute?.value
  if (current && current.path === '/login') return
  router.push({
    path: '/login',
    query: { redirect: current?.fullPath || '/' },
  })
}

// 导出供其他 api/ 子模块复用（如 api/daoIndex.js）
export async function request(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  // HTTP 层 401：未登录 → 跳 /login（但仍抛异常给调用方）
  if (res.status === 401) {
    redirectToLogin()
    let msg = '未登录'
    try {
      const json = await res.json()
      msg = json.message || msg
    } catch (_) {
      // 后端可能未返回 JSON 体
    }
    throw new ApiError(msg, { status: 401, code: 401, url })
  }

  if (!res.ok) {
    // 其它 HTTP 错误（404/500/...）：不跳 /login，优先保留后端业务提示
    let json = null
    try {
      json = await res.json()
    } catch (_) {
      // 后端可能未返回 JSON 体
    }
    throw new ApiError(json?.message || `HTTP ${res.status}: ${url}`, {
      status: res.status,
      code: json?.code || 0,
      url,
    })
  }

  const json = await res.json()

  // 业务层 401（HTTP 200 但 code:401）：等价 HTTP 401 处理
  if (json.code === 401) {
    redirectToLogin()
    throw new ApiError(json.message || '未登录', { status: 200, code: 401, url })
  }

  if (json.code !== 200) {
    // 普通业务错误（R.fail）：保留原 Error 类型，不影响现有调用方 catch (e) { e.message }
    throw new Error(json.message || '请求失败')
  }
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

// ── 错误码扫描·交易维度归属·下载 ──────────────────────────────

/**
 * 查询某交易的错误码（喂徽章 + 展开列表）
 * @param {string} txId 交易号
 * @returns {Promise<{count:number, distinctCount:number, list:Array}>}
 */
export function getErrorCodes(txId) {
  return request(`/flowtran/transactions/${encodeURIComponent(txId)}/error-codes`)
}

/**
 * 下载某交易的错误码明细 Excel（复用既有双参 download）
 * @param {string} txId 交易号
 */
export function exportErrorCodes(txId) {
  return download(
    `/flowtran/transactions/${encodeURIComponent(txId)}/error-codes/export`,
    `error-codes_${txId}.xlsx`,
  )
}

/**
 * 下载全量错误码 Excel（交易维度，复用既有双参 download）
 * @param {string} [domain] 领域 key，可选；传则只导该领域
 */
export function exportAllErrorCodes(domain) {
  const q = domain ? `?domain=${encodeURIComponent(domain)}` : ''
  return download(`/flowtran/error-codes/export${q}`, 'error-codes-all.xlsx')
}
