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

/**
 * V16+：池行（nsql）异步触发 LLM 重新分析。
 *
 * <p>与 {@link runDiiLlmAnalyzeAsync} 同款语义，只是路由到池表专用接口
 * （POST /debug/llm-analyze-pool/{poolId}/async）。前端 it.source==='nsql'
 * 时调本方法；'odb' 时调上面那个。
 * @param {number|string} poolId  池行 id
 * @param {object} [body]         { model?: string }（池行不支持 overrideSql）
 */
export function runDiiLlmAnalyzePoolAsync(poolId, body) {
  return request(`${PREFIX}/debug/llm-analyze-pool/${poolId}/async`, {
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

/* ───────────── V19 表关系 ER 图 ───────────── */

/** 重算 ER 关系（口令保护，复用 X-DII-Trigger-Token）。返回统计。 */
export async function erRebuild(env, token) {
  const qs = toQuery({ env })
  const resp = await fetch(`/api${PREFIX}/er/rebuild${qs}`, {
    method: 'POST',
    headers: { 'X-DII-Trigger-Token': token || '' },
  })
  const json = await resp.json().catch(() => ({}))
  if (resp.status === 401 || json?.code === 401) {
    const err = new Error('口令错误'); err.code = 'TOKEN_INVALID'; throw err
  }
  if (!resp.ok || json?.code !== 200) {
    const err = new Error(json?.message || `HTTP ${resp.status}`); err.code = 'REBUILD_FAILED'; throw err
  }
  return json.data
}

/** 有关系的表搜索（画布选中心表）。 */
export function erTables(env, keyword) {
  const qs = toQuery({ env, keyword })
  return request(`${PREFIX}/er/tables${qs}`)
}

/** 导入关系清单 Excel（口令保护，整库替换该 env，严格按导入内容绘制）。 */
export async function erImport(file, env, token) {
  const fd = new FormData()
  fd.append('file', file)
  if (env) fd.append('env', env)
  const resp = await fetch(`/api${PREFIX}/er/import`, {
    method: 'POST',
    headers: { 'X-DII-Trigger-Token': token || '' },
    body: fd,
  })
  const json = await resp.json().catch(() => ({}))
  if (resp.status === 401 || json?.code === 401) {
    const err = new Error('口令错误'); err.code = 'TOKEN_INVALID'; throw err
  }
  if (!resp.ok || json?.code !== 200) {
    const err = new Error(json?.message || `HTTP ${resp.status}`); err.code = 'IMPORT_FAILED'; throw err
  }
  return json.data
}

/** 绘制元信息：{ source: 'REBUILD'|'IMPORT'|null, builtAt, relationCount }。 */
export function erMeta(env) {
  const qs = toQuery({ env })
  return request(`${PREFIX}/er/meta${qs}`)
}

/**
 * 取子图。
 * @param {Object} p { env, table, hops, full, minConfidence }
 * @returns {Promise<{nodes, edges, nodeCount, edgeCount}>}
 */
export function erGraph(p = {}) {
  const qs = toQuery(p)
  return request(`${PREFIX}/er/graph${qs}`)
}

/** 人工修正关系 status（CONFIRMED/IGNORED/AUTO，口令保护）。 */
export async function setErStatus(id, value, token) {
  const resp = await fetch(`/api${PREFIX}/er/relations/${id}/status?value=${encodeURIComponent(value)}`, {
    method: 'POST',
    headers: { 'X-DII-Trigger-Token': token || '' },
  })
  const json = await resp.json().catch(() => ({}))
  if (resp.status === 401 || json?.code === 401) {
    const err = new Error('口令错误'); err.code = 'TOKEN_INVALID'; throw err
  }
  if (!resp.ok || json?.code !== 200) {
    const err = new Error(json?.message || `HTTP ${resp.status}`); err.code = 'STATUS_FAILED'; throw err
  }
  return json.data
}

/**
 * 导出关系清单 Excel。
 * v4：传 table + hops → 与画布完全一致（只导该中心表的 N 跳子图，默认 HIGH、排除 IGNORED）。
 * 不传 table 退化为全量（一般不用）。
 */
export function exportErRelations(env, minConfidence = 'HIGH', table, hops) {
  const qs = toQuery({ env, minConfidence, table, hops })
  const suffix = table ? `-${table}` : ''
  return download(`${PREFIX}/er/export${qs}`, `er-relations-${env || 'uat'}${suffix}.xlsx`)
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

/* ───────────── SQL 池 / 白名单 ───────────── */

/**
 * 分页查询 SQL 池
 * @param {Object} params {limit, offset, project, whitelist:0|1, keyword}
 * @returns {Promise<{total: number, items: Array}>}
 */
export async function listSqlPool(params = {}) {
  const qs = toQuery(params)
  const res = await request(`${PREFIX}/sql-pool${qs}`)
  if (Array.isArray(res)) return { total: res.length, items: res }
  return {
    total: Number(res?.total || 0),
    items: Array.isArray(res?.items) ? res.items : [],
  }
}

/** 拉取池表所有去重的工程名（前端下拉框） */
export async function listSqlPoolProjects() {
  const res = await request(`${PREFIX}/sql-pool/projects`)
  return Array.isArray(res) ? res : []
}

/**
 * 上传 Excel 导入到 SQL 池（multipart/form-data，受口令保护）。
 *
 * v2 改动：不再传 projectName——后端按命名 SQL 前缀自动匹配
 * （dept-bcc/loan-bcc/sett-bcc/comm-bcc/other）。
 *
 * 后端 POST /api/ai/dao-index/sql-pool/import，header X-DII-Trigger-Token 必填。
 * 错误：HTTP 401 → 抛 Error('口令错误') with err.code='TOKEN_INVALID'。
 *
 * @param {File} file       xlsx 文件
 * @param {string} env      可选环境标记
 * @param {string} token    X-DII-Trigger-Token
 * @returns {Promise<{inserted, updated, unchanged, duplicatedInBatch, skippedEntity, skippedMalformed, skippedOversize, totalRowsScanned, byProject}>}
 */
export async function uploadSqlPoolExcel(file, env, token) {
  const fd = new FormData()
  fd.append('file', file)
  if (env) fd.append('env', env)
  // 注意：不能手动设 Content-Type；浏览器会自动加 boundary
  const resp = await fetch(`/api${PREFIX}/sql-pool/import`, {
    method: 'POST',
    headers: { 'X-DII-Trigger-Token': token || '' },
    body: fd,
  })
  const json = await resp.json().catch(() => ({}))
  if (resp.status === 401 || json?.code === 401) {
    const err = new Error('口令错误')
    err.code = 'TOKEN_INVALID'
    throw err
  }
  if (!resp.ok || json?.code !== 200) {
    const err = new Error(json?.message || `HTTP ${resp.status}`)
    err.code = 'IMPORT_FAILED'
    throw err
  }
  return json.data
}

/**
 * 切换 SQL 池条目的白名单状态（受口令保护）
 * @param {number} id     池表行 id
 * @param {0|1} value     0=取消，1=置位
 * @param {string} token  X-DII-Trigger-Token
 */
export async function toggleSqlPoolWhitelist(id, value, token) {
  const resp = await fetch(
    `/api${PREFIX}/sql-pool/${id}/whitelist?value=${value === 0 ? 0 : 1}`,
    {
      method: 'POST',
      headers: { 'X-DII-Trigger-Token': token || '' },
    },
  )
  const json = await resp.json().catch(() => ({}))
  if (resp.status === 401 || json?.code === 401) {
    const err = new Error('口令错误')
    err.code = 'TOKEN_INVALID'
    throw err
  }
  if (!resp.ok || json?.code !== 200) {
    const err = new Error(json?.message || `HTTP ${resp.status}`)
    err.code = 'WHITELIST_FAILED'
    throw err
  }
  return json.data
}

/* ───────────── V16 白名单审批工作流 ───────────── */

/** 拉一级 / 二级审批人下拉名单 */
export function getWhitelistApprovers() {
  return request(`${PREFIX}/whitelist-applications/approvers`)
}

/**
 * 申请白名单
 * @param {Object} req {
 *   sqlHash, namedSql, sqlText, projectName, env,
 *   kindSource: 'odb' | 'nsql',
 *   includeNamedSql: boolean,
 *   applyReason: string,
 *   l1Approver: string username,
 *   sourceTable: 'item' | 'sql_pool',
 *   sourceId: number,
 *   applicant: string username (fallback)
 * }
 */
export function applyWhitelist(req) {
  return request(`${PREFIX}/whitelist-applications`, {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

/** 查单条申请 */
export function getWhitelistApplication(id) {
  return request(`${PREFIX}/whitelist-applications/${id}`)
}

/** 我的待办 */
export function listWhitelistTodo(params = {}) {
  const qs = toQuery(params)
  return request(`${PREFIX}/whitelist-applications${qs}`)
}

/**
 * 我的待办计数（铃铛红点用）
 * @returns {Promise<{currentUser: string, count: number}>}
 */
export function getWhitelistTodoCount(params = {}) {
  const qs = toQuery(params)
  return request(`${PREFIX}/whitelist-applications/todo-count${qs}`)
}

function postAction(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body || {}) })
}

/** L1 通过：body = { opinion, l2Approver, currentUser? } */
export function l1Approve(id, body) {
  return postAction(`${PREFIX}/whitelist-applications/${id}/l1-approve`, body)
}
/** L1 退回：body = { opinion, currentUser? } */
export function l1Reject(id, body) {
  return postAction(`${PREFIX}/whitelist-applications/${id}/l1-reject`, body)
}
/** L2 通过：body = { opinion, currentUser? } */
export function l2Approve(id, body) {
  return postAction(`${PREFIX}/whitelist-applications/${id}/l2-approve`, body)
}
/** L2 退回：body = { opinion, currentUser? }（退回 L1，带 L2 意见） */
export function l2Reject(id, body) {
  return postAction(`${PREFIX}/whitelist-applications/${id}/l2-reject`, body)
}
/** 取消：body = { currentUser? } */
export function cancelWhitelist(id, body) {
  return postAction(`${PREFIX}/whitelist-applications/${id}/cancel`, body)
}

/**
 * 切换 item（巡检明细）的白名单状态（受口令保护）
 */
export async function toggleItemWhitelist(id, value, token) {
  const resp = await fetch(
    `/api${PREFIX}/analysis-items/${id}/whitelist?value=${value === 0 ? 0 : 1}`,
    {
      method: 'POST',
      headers: { 'X-DII-Trigger-Token': token || '' },
    },
  )
  const json = await resp.json().catch(() => ({}))
  if (resp.status === 401 || json?.code === 401) {
    const err = new Error('口令错误')
    err.code = 'TOKEN_INVALID'
    throw err
  }
  if (!resp.ok || json?.code !== 200) {
    const err = new Error(json?.message || `HTTP ${resp.status}`)
    err.code = 'WHITELIST_FAILED'
    throw err
  }
  return json.data
}

/* ───────────── V20 慢SQL维度分析 ───────────── */

/** 导入慢SQL明细（.xlsx/.xls/.csv，口令保护；v2：轮次必填，同轮覆盖） */
export async function importSlowSql(file, env, token, round) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('round', round || '')
  if (env) fd.append('env', env)
  const resp = await fetch(`/api${PREFIX}/slow-sql/import`, {
    method: 'POST',
    headers: { 'X-DII-Trigger-Token': token || '' },
    body: fd,
  })
  const json = await resp.json().catch(() => ({}))
  if (resp.status === 401 || json?.code === 401) {
    const err = new Error('口令错误'); err.code = 'TOKEN_INVALID'; throw err
  }
  if (!resp.ok || json?.code !== 200) {
    const err = new Error(json?.message || `HTTP ${resp.status}`); err.code = 'IMPORT_FAILED'; throw err
  }
  return json.data
}

/** 慢SQL聚合列表 { total, items } */
export function listSlowSql(params = {}) {
  const qs = toQuery(params)
  return request(`${PREFIX}/slow-sql${qs}`)
}

/** 慢SQL领域下拉（中文领域） */
export function listSlowSqlDomains() {
  return request(`${PREFIX}/slow-sql/domains`)
}

/** 慢SQL类型下拉（中文类型：联机/热点账户/批量） */
export function listSlowSqlBizTypes() {
  return request(`${PREFIX}/slow-sql/biz-types`)
}

/** 慢SQL轮次下拉（升序；前端默认选最新=末位） */
export function listSlowSqlRounds() {
  return request(`${PREFIX}/slow-sql/rounds`)
}

/* ── v3：慢SQL 采集过滤名单（抽象SQL 以名单前缀开头 → 导入不纳入采集）── */

/** 名单列表（只读） */
export function listSlowSqlCollectFilters() {
  return request(`${PREFIX}/slow-sql/collect-filters`)
}

/** 新增前缀（口令保护，与导入口令一致） */
export async function addSlowSqlCollectFilter(prefix, token) {
  const resp = await fetch(
    `/api${PREFIX}/slow-sql/collect-filters?prefix=${encodeURIComponent(prefix)}`,
    { method: 'POST', headers: { 'X-DII-Trigger-Token': token || '' } },
  )
  const json = await resp.json().catch(() => ({}))
  if (resp.status === 401 || json?.code === 401) {
    const err = new Error('口令错误'); err.code = 'TOKEN_INVALID'; throw err
  }
  if (!resp.ok || json?.code !== 200) {
    throw new Error(json?.message || `HTTP ${resp.status}`)
  }
  return json.data
}

/** 删除条目（口令保护） */
export async function deleteSlowSqlCollectFilter(id, token) {
  const resp = await fetch(`/api${PREFIX}/slow-sql/collect-filters/${id}`, {
    method: 'DELETE', headers: { 'X-DII-Trigger-Token': token || '' },
  })
  const json = await resp.json().catch(() => ({}))
  if (resp.status === 401 || json?.code === 401) {
    const err = new Error('口令错误'); err.code = 'TOKEN_INVALID'; throw err
  }
  if (!resp.ok || json?.code !== 200) {
    throw new Error(json?.message || `HTTP ${resp.status}`)
  }
  return json.data
}

/**
 * 导出慢SQL Excel（v3：与页面筛选联动，列与页面一致；跨分页全量）。
 * @param {Object} params { env, round, domain, bizType, keyword, whitelistStatus }
 */
export function exportSlowSql(params = {}) {
  const qs = toQuery(params)
  return download(`${PREFIX}/slow-sql/export${qs}`, `slow-sql-${params.round || 'all'}.xlsx`)
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
