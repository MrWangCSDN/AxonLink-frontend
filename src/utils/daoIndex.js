/**
 * SQL 巡检 —— 前端辅助工具函数
 */

/** 评级 label 映射（与后端 IndexRating enum 对齐） */
export const RATING_LABEL = {
  POOR: '差',
  GOOD: '良',
  EXCELLENT: '优',
  NOT_APPLICABLE: '不适用',
}

export const LLM_STATUS_LABEL = {
  PENDING: '待分析',
  DONE: '已完成',
  FAILED: '失败',
  SKIPPED: '已跳过',
}

/** JSON 字符串安全反序列化，失败返回默认值 */
export function safeParse(jsonStr, fallback = null) {
  if (!jsonStr) return fallback
  if (typeof jsonStr !== 'string') return jsonStr
  try {
    return JSON.parse(jsonStr)
  } catch {
    return fallback
  }
}

/** 相对时间（2 小时前） */
export function timeAgo(dateLike) {
  if (!dateLike) return '-'
  const t = typeof dateLike === 'string' ? new Date(dateLike).getTime() : dateLike
  if (Number.isNaN(t)) return '-'
  const diff = Date.now() - t
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + ' 分钟前'
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + ' 小时前'
  const days = Math.floor(diff / 86_400_000)
  if (days < 30) return days + ' 天前'
  return new Date(t).toISOString().slice(0, 10)
}

/** 格式化毫秒为 "1h23m" */
export function formatElapsed(ms) {
  if (ms == null || ms < 0) return '-'
  const s = Math.round(ms / 1000)
  if (s < 60) return s + 's'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h${m % 60}m`
}

/** 把 involved_tables CSV 转成数组 */
export function splitTables(csv) {
  if (!csv) return []
  return csv.split(',').map((s) => s.trim()).filter(Boolean)
}

/** SQL 原文简单格式化（保留原样但截短展示） */
export function truncate(s, n = 120) {
  if (!s) return ''
  return s.length <= n ? s : s.slice(0, n) + '…'
}

/* ──────────────── 领域归属映射 ──────────────── */

/**
 * project_name → 4 个业务领域的映射规则：
 *   dept-bcc  → 存款
 *   loan-bcc  → 贷款
 *   comm-bcc  → 公共
 *   sett-bcc  → 结算
 *   其他        → 其他
 *
 * 兼容 project_name 带路径/后缀的情况（取短名 + 小写 + 包含匹配）。
 */
const DOMAIN_RULES = [
  { key: 'deposit',    label: '存款', match: (p) => p.includes('dept-bcc') },
  { key: 'loan',       label: '贷款', match: (p) => p.includes('loan-bcc') },
  { key: 'common',     label: '公共', match: (p) => p.includes('comm-bcc') },
  { key: 'settlement', label: '结算', match: (p) => p.includes('sett-bcc') },
]

export const DAO_DOMAIN_OPTIONS = [
  { key: 'deposit',    label: '存款' },
  { key: 'loan',       label: '贷款' },
  { key: 'common',     label: '公共' },
  { key: 'settlement', label: '结算' },
  { key: 'other',      label: '其他' },
]

/**
 * 根据 project_name 推导业务领域。
 * @param {string} projectName
 * @returns {{ key: string, label: string }}
 */
export function resolveDomain(projectName) {
  if (!projectName) return { key: 'other', label: '其他' }
  const p = String(projectName).toLowerCase()
  for (const rule of DOMAIN_RULES) {
    if (rule.match(p)) return { key: rule.key, label: rule.label }
  }
  return { key: 'other', label: '其他' }
}

/* ──────────────── 列表"发现的问题"列解析 ──────────────── */

/**
 * 为"发现的问题"列聚合出一个可渲染的对象。
 * 按用户约定的优先级/口径：
 *   1. explain_error 非空 → source=EXPLAIN_ERROR，message=explain_error
 *   2. llm_status === 'DONE'    → source=LLM_FINDINGS，findings=解析后的 JSON 数组
 *   3. llm_status === 'PENDING' → source=LLM_PENDING（AI 正在分析）
 *   4. llm_status === 'FAILED'  → source=LLM_ERROR，message=llm_error
 *   其他（比如 SKIPPED） → source=NONE
 *
 * @param {object} row 列表行（来自 /debug/analysis-items-issues）
 * @returns {{
 *   source: 'EXPLAIN_ERROR' | 'LLM_FINDINGS' | 'LLM_PENDING' | 'LLM_ERROR' | 'NONE',
 *   message?: string,
 *   findings?: Array<{severity?: string, type?: string, description?: string, evidence?: string}>,
 *   count: number,
 * }}
 */
export function resolveIssueCell(row) {
  if (!row) return { source: 'NONE', count: 0 }

  // 优先级 1：数据库报错
  const explainErr = row.explain_error || row.explainError
  if (explainErr) {
    return {
      source: 'EXPLAIN_ERROR',
      message: String(explainErr).trim(),
      count: 1,
    }
  }

  const status = row.llm_status || row.llmStatus

  // 优先级 2：LLM 已完成，展示 findings
  if (status === 'DONE') {
    const findings = safeParse(row.llm_findings_json || row.llmFindingsJson, []) || []
    return {
      source: 'LLM_FINDINGS',
      findings,
      count: findings.length,
    }
  }

  // 优先级 3：LLM 分析中
  if (status === 'PENDING') {
    return {
      source: 'LLM_PENDING',
      message: 'AI 正在分析，请稍候…',
      count: 0,
    }
  }

  // 优先级 4：LLM 失败，展示 error
  if (status === 'FAILED') {
    const msg = row.llm_error || row.llmError || '模型调用失败（后端未返回错误信息）'
    return {
      source: 'LLM_ERROR',
      message: String(msg).trim(),
      count: 1,
    }
  }

  return { source: 'NONE', count: 0 }
}

/**
 * 为"AI 建议"列聚合出可渲染的对象。
 * 仅当 llm_status === 'DONE' 时才有内容，其他场景为空。
 *
 * @param {object} row
 * @returns {{
 *   source: 'LLM_SUGGESTIONS' | 'NONE',
 *   suggestions?: Array<object>,
 *   count: number,
 * }}
 */
export function resolveSuggestionCell(row) {
  if (!row) return { source: 'NONE', count: 0 }
  const status = row.llm_status || row.llmStatus
  if (status !== 'DONE') return { source: 'NONE', count: 0 }
  const arr = safeParse(row.llm_suggestions_json || row.llmSuggestionsJson, []) || []
  return {
    source: 'LLM_SUGGESTIONS',
    suggestions: arr,
    count: arr.length,
  }
}

/* ──────────────── SQL 单行压缩（列表展示用） ──────────────── */

/**
 * 把多行 SQL 压成一行，去掉多余空白。
 * 用于表格 title 提示里显示完整 SQL，或做预览截断。
 */
export function sqlOneLine(sql) {
  if (!sql) return ''
  return String(sql).replace(/\s+/g, ' ').trim()
}

/* ──────────────── 其他小工具 ──────────────── */

/** 复制到剪贴板 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text || '')
    return true
  } catch {
    // Fallback 兼容老环境
    try {
      const ta = document.createElement('textarea')
      ta.value = text || ''
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      return true
    } catch {
      return false
    }
  }
}
