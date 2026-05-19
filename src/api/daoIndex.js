/**
 * SQL 巡检模块 API
 *
 * 后端对应：com.axonlink.ai.daoindex.controller.DaoIndexController
 * 路由前缀：/api/ai/dao-index
 *
 * 所有接口返回 ApiResult<T>，在 request() 里已统一脱壳为 data。
 */
import { request, download } from './index.js'

const PREFIX = '/ai/dao-index'

/* ───────────── 健康检查 ───────────── */

/** 模块健康检查（目标库/结果库/LLM 连通性） */
export function getDiiHealth() {
  return request(`${PREFIX}/health`)
}

/* ───────────── 概览仪表盘 ───────────── */

/**
 * 概览仪表盘真实数据（4 块合并：byDomain / ratingByDomain / trend7d / elapsed7d）。
 *
 * 后端：GET /api/ai/dao-index/dashboard?env=...
 * 返回结构：
 * {
 *   env, latestTask: { id, task_no, env, created_at, updated_at, total_sqls, ... } | null,
 *   byDomain: [ { domain, total, explain_err, llm_fix }, ... ],
 *   ratingByDomain: [ { domain, error_count, need_fix }, ... ],                       // v3 整改分布 2 档
 *   trend7d: [ { task_id, day, domain, error_count, need_fix }, ... ],   // 按(任务×领域)明细，时间正序
 *   elapsed7d: [ { task_id, day, elapsed_seconds, total_sqls }, ... ]         // 时间正序
 * }
 *
 * <p>本地 dev 没起后端时（fetch 命中 vite 的 SPA 兜底返回 index.html），
 * 自动降级返回 mock 数据，前端能看到完整布局。
 *
 * @param {string} env 环境，如 'uat'
 * @returns {Promise<object>}
 */
export async function getDiiDashboard(env = 'uat') {
  const qs = toQuery({ env })
  try {
    const res = await request(`${PREFIX}/dashboard${qs}`)
    // 后端连通且返回符合契约 → 直接用
    if (res && typeof res === 'object' && (res.byDomain || res.latestTask !== undefined)) {
      return res
    }
    // 返回是字符串（HTML 兜底） / 不是对象 → 走 mock 降级
    throw new Error('dashboard 返回结构异常，使用 mock 降级')
  } catch (e) {
    // dev 环境后端不可达 / SPA 兜底 / 真实失败 — 全部走 mock 降级
    // 用 console.warn 提示但不中断 UI
    if (typeof console !== 'undefined') {
      console.warn('[DiiDashboard] 后端不可达或返回异常，降级到 mock：', e?.message || e)
    }
    const { getDaoDashboardRealMock } = await import('../mocks/daoDashboardRealMock.js')
    return getDaoDashboardRealMock(env)
  }
}

/* ───────────── SQL 分析结果 ───────────── */

/**
 * 按条件分页列出已落库的 SQL 分析结果。
 * @param {Object} params 可选过滤
 *   env, overallRating, runtimeRating, llmStatus,
 *   hasExplainError, disagreement, tableName, projectName,
 *   taskId, keyword, limit=50, offset=0
 */
export function listDiiItems(params = {}) {
  const qs = toQuery(params)
  return request(`${PREFIX}/debug/analysis-items${qs}`)
}

/**
 * "问题列表"视图：只返回 EXPLAIN 报错或 LLM 已有终态（DONE/FAILED）的行。
 * 相比 listDiiItems 额外带：sql_text / explain_error / llm_status / llm_error /
 *   llm_summary / llm_findings_json / llm_suggestions_json。
 *
 * @param {Object} params { env, taskId, limit=50, offset=0 }
 * @returns {Promise<{total, limit, offset, items: Array}>}
 */
export function listDiiItemIssues(params = {}) {
  const qs = toQuery(params)
  return request(`${PREFIX}/debug/analysis-items-issues${qs}`)
}

/**
 * "问题列表" 4 个 KPI 统计（总数 / DB 报错 / AI 完成 / AI 失败）。
 * 一次 SQL 出 4 个数字，避免前端全量拉取 items 后本地 group。
 *
 * @param {Object} params { env, taskId }
 * @returns {Promise<{total: number, explainError: number, llmFindings: number, llmError: number}>}
 */
export function getDiiItemIssuesStats(params = {}) {
  const qs = toQuery(params)
  return request(`${PREFIX}/debug/analysis-items-issues/stats${qs}`)
}

/**
 * 取指定环境下"最新一条已完成（status=DONE）的巡检任务"。
 *
 * <p>SQL 分析页严格要求展示已完成任务的数据：
 * 如果当前正在跑的任务（PENDING/RUNNING）还没出结果，业务上需要回退到上一轮 DONE 任务的数据。
 * 后端 list(env, 'DONE', limit=1) 已经做完过滤，前端取数组第一条即可。
 *
 * @param {string} env
 * @returns {Promise<object|null>} 任务对象（含 id / task_no / status / total_sqls / ...），无则返回 null
 */
export async function getLatestDiiTask(env = 'uat') {
  const qs = toQuery({ env, status: 'DONE', limit: 1 })
  const res = await request(`${PREFIX}/batch-tasks${qs}`)
  const list = Array.isArray(res) ? res : (res?.items || res?.data || [])
  return list.length > 0 ? list[0] : null
}

/**
 * 全量导出"问题列表" 为 Excel（浏览器触发下载）。
 * 后端会循环分页拉取该 env+taskId 下所有 explain_error 或 LLM 终态行，
 * 用 Apache POI 拼装 19 列的 .xlsx 返回。
 *
 * @param {Object} params { env, taskId }
 * @returns {Promise<{fileName: string}>} 下载完成后的文件名
 */
export function exportDiiItemIssues(params = {}) {
  const qs = toQuery(params)
  // 默认文件名（实际名以后端 Content-Disposition 为准）
  const fallback = `sql-analysis-issues-${params.env || 'uat'}.xlsx`
  return download(`${PREFIX}/debug/analysis-items-issues/export${qs}`, fallback)
}

/** 查单条 SQL 详情 */
export function getDiiItem(id) {
  return request(`${PREFIX}/debug/analysis-items/${id}`)
}

/**
 * 单条手动触发 LLM 分析（阻塞返回，可能 2 分钟）
 * @param {number|string} id  分析记录 id
 * @param {object} [body]     可选，{ sql?: string, model?: string } —— 用户在重跑模态框里改过的 SQL / 选择的模型
 */
export function runDiiLlmAnalyze(id, body) {
  return request(`${PREFIX}/debug/llm-analyze/${id}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * 异步触发单条 LLM 分析：后端立即返回 { accepted, status:'PENDING' }，
 * 真正的 LLM 调用在线程池里跑。前端拿到响应后开始轮询 getDiiItem(id)。
 *
 * 适用场景：用户点击"重新分析"，前端要立刻关弹窗、稳定显示蒙版，不阻塞 UI。
 *
 * @param {number|string} id   分析记录 id
 * @param {object} [body]      { sql?: string, model?: string }
 * @returns {Promise<{accepted: true, itemId: number, status: 'PENDING'}>}
 */
export function runDiiLlmAnalyzeAsync(id, body) {
  return request(`${PREFIX}/debug/llm-analyze/${id}/async`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/** 预览当前 item 喂给 LLM 的完整 prompt（调试用） */
export function previewDiiLlmPrompt(id) {
  return request(`${PREFIX}/debug/llm-preview-prompt/${id}`)
}

/* ───────────── 批量 LLM 回填 ───────────── */

/**
 * 批量跑 LLM，异步返回。
 * @param {Object} params { env, taskId, onlyFailed=false, maxItems=1000 }
 */
export function runDiiLlmEnrich(params = {}) {
  const qs = toQuery(params)
  return request(`${PREFIX}/llm-enrich${qs}`, { method: 'POST' })
}

/* ───────────── 巡检任务 ───────────── */

/**
 * 分页列出巡检任务（每行已带 5 项统计：poor_total / explain_err / llm_done / llm_failed / llm_running）。
 *
 * 后端返回 {total, items} 包装，本函数解包成 {total, items} 直接返回；
 * 兼容老调用 getLatestDiiTask() 沿用各自路径，不破坏现有接口。
 *
 * @param {Object} params 可选过滤
 *   env: 'uat' | 'dev' | 'prod'
 *   status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'RUNNING_OR_PENDING'
 *   limit: 默认 20，最大 500
 *   offset: 默认 0
 * @returns {Promise<{total: number, items: Array<Object>}>}
 */
export async function listDiiTasks(params = {}) {
  const qs = toQuery(params)
  const res = await request(`${PREFIX}/batch-tasks${qs}`)
  // request() 已脱壳 R 包装，res 直接是 {total, items}
  // 兼容旧返回（直接是数组）：包装一层
  if (Array.isArray(res)) {
    return { total: res.length, items: res }
  }
  return {
    total: Number(res?.total || 0),
    items: Array.isArray(res?.items) ? res.items : [],
  }
}

/**
 * 手动触发一次巡检任务（受口令保护）。
 *
 * 后端 POST /api/ai/dao-index/batch-analyze，header X-DII-Trigger-Token 必填。
 * 错误：HTTP 401 → 抛 Error('口令错误')；其他错误抛后端原 message。
 *
 * @param {string} env 环境，如 'uat'
 * @param {string} token X-DII-Trigger-Token 请求头值
 * @returns {Promise<{taskId: number, env: string, status: string, pollUrl: string}>}
 * @throws {Error} 401 时抛 Error('口令错误')
 */
export async function triggerDiiBatch(env, token) {
  const qs = toQuery({ env })
  // request() 默认 GET；这里手动 fetch 以便控制 method + header
  // 注意：request 的内部 fetch 路径前缀是 /api，我们这里也走相同前缀保持一致
  const url = `/api${PREFIX}/batch-analyze${qs}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DII-Trigger-Token': token || '',
    },
  })
  const json = await resp.json().catch(() => ({}))
  if (resp.status === 401 || json?.code === 401) {
    // 同时携带 code 字段，调用方可按 err.code === 'TOKEN_INVALID' 匹配（避免文案字符串硬绑定）
    const err = new Error('口令错误')
    err.code = 'TOKEN_INVALID'
    throw err
  }
  // 后端统一响应 R：成功为 code=200, message="success"（无 success 布尔字段）。
  // 此处历史上误判 code!==0（R 体系从无 code===0 约定），导致成功也抛 Error("success")
  // → 弹窗显示"触发失败：success"。改为与通用 request() 一致判 code!==200。
  if (!resp.ok || json?.code !== 200) {
    const err = new Error(json?.message || `HTTP ${resp.status}`)
    err.code = 'TRIGGER_FAILED'
    throw err
  }
  return json.data
}

/** 查任务详情 + 进度 */
export function getDiiTask(id) {
  return request(`${PREFIX}/batch-tasks/${id}`)
}

/** 新起一次巡检（异步） */
export function startDiiBatch(env = 'uat') {
  return request(`${PREFIX}/batch-analyze?env=${encodeURIComponent(env)}`, {
    method: 'POST',
  })
}

/* ───────────── 表维度聚合 ───────────── */

/** 某张表的 LLM 建议去重聚合 */
export function getDiiTableAdvice(env, table) {
  const qs = toQuery({ env, table })
  return request(`${PREFIX}/debug/table-advice-rollup${qs}`)
}

/* ───────────── 工具：把对象变成 ?a=1&b=2 ───────────── */

function toQuery(params) {
  const entries = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!entries.length) return ''
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return '?' + qs
}
