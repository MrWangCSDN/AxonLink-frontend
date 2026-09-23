import { createHash } from 'node:crypto'

/**
 * DAO 索引巡检 · 开发期 mock 中间件
 *
 * 在 vite dev server 上拦截 /api/ai/dao-index/* 路径，按真实后端
 * （com.axonlink.ai.daoindex.controller.DaoIndexController）的契约
 * 返回结构化假数据。前端代码无需任何改动。
 *
 * 拦截端点：
 *  - GET /api/ai/dao-index/batch-tasks?env=...
 *  - GET /api/ai/dao-index/debug/analysis-items-issues?env=&taskId=&limit=&offset=
 *  - GET /api/ai/dao-index/debug/analysis-items-issues/export?env=&taskId=
 *  - POST /api/ai/dao-index/debug/llm-analyze/{itemId}
 *  - GET /api/flowtran/env  （AppHeader 启动时会请求，简单返回）
 */

const FIXED_TASK_ID = 7
const FIXED_ENV = 'uat'

// ────────────── 真实数据形态生成 ──────────────

const PROJECTS = [
  'dept-bcc-account-service',
  'dept-bcc-balance-service',
  'loan-bcc-credit-service',
  'loan-bcc-repayment-service',
  'comm-bcc-customer-service',
  'comm-bcc-product-service',
  'sett-bcc-clearing-service',
  'sett-bcc-interbank-service',
]

const TABLE_SEEDS = [
  ['T_ACC_BALANCE', 'T_ACC_CORE_INFO'],
  ['T_TXN_JOURNAL', 'T_ORDER_MATCH_LOG'],
  ['T_LOAN_CONTRACT', 'T_LOAN_REPAYMENT_PLAN'],
  ['T_CLR_BATCH', 'T_CLR_DETAIL', 'T_CLR_CHANNEL'],
  ['T_CUST_BASIC', 'T_CUST_EXTENSION'],
  ['T_PROD_DEFINITION', 'T_PROD_PARAM'],
  ['T_INTERBANK_LOG'],
  ['T_FEE_RULE', 'T_FEE_DETAIL'],
]

const SQL_TEMPLATES = [
  {
    kind: 'SELECT',
    sql:
`SELECT a.acc_no, a.acc_name, a.acc_status,
       b.balance_amt, b.available_amt, b.update_time
FROM T_ACC_BALANCE b
LEFT JOIN T_ACC_CORE_INFO a ON a.acc_no = b.acc_no
WHERE b.acc_status = ?
  AND b.update_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
ORDER BY b.update_time DESC
LIMIT 500`,
  },
  {
    kind: 'SELECT',
    sql:
`SELECT j.txn_id, j.txn_amt, j.txn_status, j.create_time,
       o.order_id, o.match_result
FROM T_TXN_JOURNAL j
INNER JOIN T_ORDER_MATCH_LOG o ON o.txn_id = j.txn_id
WHERE j.create_time BETWEEN ? AND ?
  AND j.txn_status IN ('SUCCESS','PARTIAL_SUCCESS')
  AND j.channel_id = ?`,
  },
  {
    kind: 'UPDATE',
    sql:
`UPDATE T_LOAN_CONTRACT
SET contract_status = ?,
    last_update_time = NOW(),
    last_operator    = ?
WHERE contract_no = ?
  AND tenant_id   = ?`,
  },
  {
    kind: 'SELECT',
    sql:
`SELECT * FROM T_CLR_DETAIL
WHERE batch_no = ?
  AND clr_status <> 'DONE'
ORDER BY id ASC`,
  },
  {
    kind: 'DELETE',
    sql:
`DELETE FROM T_INTERBANK_LOG
WHERE create_time < DATE_SUB(NOW(), INTERVAL 90 DAY)`,
  },
  {
    kind: 'SELECT',
    sql:
`SELECT cust_id, cust_name, id_no, mobile, email
FROM T_CUST_BASIC
WHERE cust_status = '1'
  AND open_branch_id IN (?, ?, ?, ?, ?)
ORDER BY register_time DESC`,
  },
  {
    kind: 'INSERT',
    sql:
`INSERT INTO T_FEE_DETAIL (fee_id, txn_id, fee_amt, fee_type, create_time)
SELECT ?, txn_id, ?, ?, NOW()
FROM T_TXN_JOURNAL
WHERE txn_id = ?
  AND txn_status = 'SUCCESS'`,
  },
  {
    kind: 'SELECT',
    sql:
`SELECT p.prod_id, p.prod_name, pp.param_key, pp.param_value
FROM T_PROD_DEFINITION p
LEFT JOIN T_PROD_PARAM pp ON pp.prod_id = p.prod_id
WHERE p.prod_status = 'ACTIVE'
ORDER BY p.prod_id`,
  },
]

const FINDING_BANK = [
  { severity: 'HIGH',   type: 'NO_INDEX',           description: '过滤字段 update_time 未命中索引，全表扫描 50w+ 行' },
  { severity: 'HIGH',   type: 'IMPLICIT_CAST',      description: 'WHERE 条件里 acc_status 为字符串字面量但列定义为 TINYINT，触发隐式转换导致索引失效' },
  { severity: 'MEDIUM', type: 'LEFT_JOIN_ORDER',    description: 'LEFT JOIN 左右表顺序可能反了：小表 T_ACC_CORE_INFO 应作为驱动表' },
  { severity: 'MEDIUM', type: 'ORDER_BY_FILESORT',  description: 'ORDER BY 字段与 WHERE 字段顺序不匹配，会回表排序' },
  { severity: 'MEDIUM', type: 'NULLABLE_PARAM',     description: '传入参数允许为 null，可能导致执行计划在 EXPLAIN 与运行时不一致' },
  { severity: 'LOW',    type: 'SELECT_STAR',        description: 'SELECT * 在该宽表会拉回 90+ 列，建议显式列出业务必需字段' },
  { severity: 'LOW',    type: 'NO_LIMIT',           description: '查询无 LIMIT 兜底，列表接口存在内存爆炸风险' },
  { severity: 'HIGH',   type: 'CARTESIAN_RISK',     description: '检测到 JOIN 条件可能不完整，存在笛卡尔积风险' },
]

const SUGGESTION_BANK = [
  {
    scope: 'TABLE',
    type: 'ADD_INDEX',
    reason: '在过滤+排序复合维度上建联合索引，可让 ORDER BY 走 index scan 免除排序',
    ddl: 'CREATE INDEX idx_status_uptime ON T_ACC_BALANCE(acc_status, update_time);',
  },
  {
    scope: 'SQL',
    type: 'REWRITE',
    reason: '把范围条件改写成两段平等条件后可命中现有 (channel_id, create_time) 索引',
    newSql:
      "WHERE j.channel_id = ?\n  AND j.create_time >= ? AND j.create_time < ?\n  AND j.txn_status IN ('SUCCESS','PARTIAL_SUCCESS')",
  },
  {
    scope: 'SQL',
    type: 'REMOVE_SELECT_STAR',
    reason: '只取业务必需的 8 个字段，减少回表与网络开销',
    newSql: 'SELECT cust_id, cust_name, id_no, mobile, email, register_time, open_branch_id, cust_level FROM T_CUST_BASIC ...',
  },
  {
    scope: 'TABLE',
    type: 'ADD_INDEX',
    reason: '为 batch_no 建唯一性辅助索引，避免每次清算扫全表',
    ddl: 'CREATE INDEX idx_batch_status ON T_CLR_DETAIL(batch_no, clr_status);',
  },
]

const EXPLAIN_ERROR_BANK = [
  "Table 'fund_uat.T_FEE_DETAIL_TMP' doesn't exist",
  'You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version near \"\\\"\" at line 6',
  'Unknown column \'last_operator\' in \'field list\'',
  'Data too long for column \'cust_name\' at row 1',
  'Lock wait timeout exceeded; try restarting transaction',
  'Cannot resolve column reference: T_TXN_JOURNAL.tenant_id',
]

const LLM_ERROR_BANK = [
  'connection timeout: upstream model server did not respond within 30s',
  'rate limit exceeded: please retry after 60s',
  'invalid response from model: response truncated at 4096 tokens, JSON parse failed',
  'context too long: 12453 tokens > 8192 max',
]

// ────────────── 确定性随机 ──────────────

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

// ────────────── 数据生成 ──────────────

function buildItems(env) {
  const total = 86
  const rng = mulberry32(0xC0FFEE + (env || '').length)
  const items = []

  // 类型分布：12 条 explain_error / 60 条 llm DONE 含 findings / 14 条 llm FAILED
  const kinds = []
  for (let i = 0; i < 12; i++) kinds.push('EXPLAIN')
  for (let i = 0; i < 60; i++) kinds.push('FINDINGS')
  for (let i = 0; i < 14; i++) kinds.push('LLM_FAIL')
  // 打乱
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }

  const now = Date.now()
  for (let i = 0; i < total; i++) {
    const id = 100000 + i
    const tpl = SQL_TEMPLATES[i % SQL_TEMPLATES.length]
    const project = pick(rng, PROJECTS)
    const tables = TABLE_SEEDS[i % TABLE_SEEDS.length]
    const classFqn =
      'com.bank.' +
      (project.split('-')[0] || 'core') +
      '.dao.' + tables[0].toLowerCase().replace(/^t_/, '').replace(/_/g, '') + 'Dao'
    const methodName = ['queryByCondition', 'listActiveRows', 'updateStatus', 'batchInsert', 'deleteExpired'][i % 5]
    const createdAt = new Date(now - (total - i) * 600000).toISOString().replace('T', ' ').slice(0, 19)
    const ratings = ['POOR', 'GOOD', 'EXCELLENT', 'NOT_APPLICABLE']
    const overallRating = ratings[Math.floor(rng() * ratings.length)]

    const base = {
      id,
      sql_hash: 'sha256:' + (id * 7919).toString(16),
      sql_kind: tpl.kind,
      env: env || FIXED_ENV,
      task_id: FIXED_TASK_ID,
      project_name: project,
      class_fqn: classFqn,
      method_name: methodName,
      overall_rating: overallRating,
      rating_label: overallRating === 'POOR' ? '差' : overallRating === 'GOOD' ? '良' : overallRating === 'EXCELLENT' ? '优' : '不适用',
      involved_tables: tables.join(','),
      rule_engine_elapsed_ms: 5 + Math.floor(rng() * 80),
      status: 'COMPLETED',
      created_at: createdAt,
      sql_text: tpl.sql,
      explain_error: null,
      llm_status: null,
      llm_error: null,
      llm_summary: null,
      llm_findings_json: null,
      llm_suggestions_json: null,
      llm_model: null,
      llm_prompt_version: null,
      llm_elapsed_ms: null,
      llm_called_at: null,
      llm_confidence: null,
    }

    const kind = kinds[i]
    if (kind === 'EXPLAIN') {
      base.explain_error = EXPLAIN_ERROR_BANK[i % EXPLAIN_ERROR_BANK.length]
    } else if (kind === 'LLM_FAIL') {
      base.llm_status = 'FAILED'
      base.llm_error = LLM_ERROR_BANK[i % LLM_ERROR_BANK.length]
      base.llm_called_at = createdAt
      base.llm_model = 'glm-4.5-pro'
      base.llm_prompt_version = 'sql-inspect/v3'
    } else {
      // FINDINGS
      base.llm_status = 'DONE'
      const fcount = 1 + Math.floor(rng() * 4)
      const findings = []
      for (let k = 0; k < fcount; k++) findings.push(FINDING_BANK[(i + k) % FINDING_BANK.length])
      base.llm_findings_json = JSON.stringify(findings)
      const scount = 1 + Math.floor(rng() * 3)
      const suggestions = []
      for (let k = 0; k < scount; k++) suggestions.push(SUGGESTION_BANK[(i + k) % SUGGESTION_BANK.length])
      base.llm_suggestions_json = JSON.stringify(suggestions)
      // 与真实后端口径对齐：llm_confidence 是 HIGH/MEDIUM/LOW 字符串档位
      const confTier = ['HIGH', 'MEDIUM', 'LOW'][Math.min(2, Math.floor(rng() * 3))]
      base.llm_summary = `共发现 ${fcount} 处可优化点，置信度 ${confTier}`
      base.llm_confidence = confTier
      base.llm_elapsed_ms = 1200 + Math.floor(rng() * 4000)
      base.llm_called_at = createdAt
      base.llm_model = 'glm-4.5-pro'
      base.llm_prompt_version = 'sql-inspect/v3'
    }
    items.push(base)
  }
  return items
}

// 缓存（同一进程内不抖动）
const CACHE = new Map()
function getItems(env) {
  if (!CACHE.has(env)) CACHE.set(env, buildItems(env))
  return CACHE.get(env)
}

/**
 * 详情页用：把列表里的精简 item 富化为含 EXPLAIN 计划、索引矩阵、
 * 规则 vs 运行时分歧、表级评级等"工程级"字段的完整记录。
 *
 * 这些字段在真实后端由 /debug/analysis-items/{id} 返回；mock 这里按 id
 * 确定性生成，确保同一条 SQL 反复打开看到的数据完全一致。
 */
function enrichItem(it) {
  const rng = mulberry32(0x1F00D + (it.id || 0))
  const tables = (it.involved_tables || '').split(',').filter(Boolean)
  const ruleRating = it.overall_rating || 'GOOD'
  const isExplainErr = !!it.explain_error
  const llmHasFindings = (it.llm_findings_json && safeParseLen(it.llm_findings_json) > 0)

  // 运行时评级：让一部分行与规则评级"分歧"，造出真实价值场景
  // 规则=GOOD 但 EXPLAIN=POOR（或反之）时触发 banner
  let runtimeRating
  if (isExplainErr) {
    runtimeRating = 'POOR'
  } else if (rng() < 0.25) {
    // 25% 概率与规则评级不同
    const ladder = ['POOR', 'GOOD', 'EXCELLENT']
    const idx = ladder.indexOf(ruleRating === 'NOT_APPLICABLE' ? 'GOOD' : ruleRating)
    const swap = idx === 0 ? 1 : (idx === ladder.length - 1 ? idx - 1 : (rng() < 0.5 ? idx - 1 : idx + 1))
    runtimeRating = ladder[swap]
  } else {
    runtimeRating = ruleRating === 'NOT_APPLICABLE' ? 'GOOD' : ruleRating
  }
  const disagreement = ruleRating !== 'NOT_APPLICABLE' && runtimeRating !== ruleRating

  let disagreementReason = null
  if (disagreement) {
    if (runtimeRating === 'POOR' && ruleRating !== 'POOR') {
      disagreementReason =
        '规则引擎认为查询字段已建索引，但 EXPLAIN 显示实际走了全表扫描——' +
        '通常由「隐式类型转换 / 函数包裹索引列 / 范围条件后置」等原因导致索引失效'
    } else if (runtimeRating !== 'POOR' && ruleRating === 'POOR') {
      disagreementReason =
        '规则引擎以静态字段判定为差，但 EXPLAIN 命中了非显而易见的覆盖索引或 InnoDB 索引下推优化，实际执行成本可控'
    } else {
      disagreementReason = '规则与执行计划评级方向一致但等级不同，建议人工复核索引覆盖率与数据量预估'
    }
  }

  // EXPLAIN 基础指标
  const isPoor = runtimeRating === 'POOR'
  const explainBasics = isExplainErr ? null : {
    explain_top_cost: +(isPoor ? 12000 + rng() * 88000 : 80 + rng() * 600).toFixed(2),
    explain_est_rows: isPoor ? Math.floor(50000 + rng() * 950000) : Math.floor(50 + rng() * 5000),
    explain_has_seq_scan: isPoor ? 1 : 0,
    explain_elapsed_ms: Math.floor(2 + rng() * 38),
  }

  // EXPLAIN 原始 plan（简化的 MySQL 8 风格 JSON）
  const explainPlan = isExplainErr ? null : {
    query_block: {
      select_id: 1,
      cost_info: { query_cost: String(explainBasics.explain_top_cost) },
      table: {
        table_name: tables[0] || 't_unknown',
        access_type: isPoor ? 'ALL' : 'ref',
        possible_keys: ['idx_status_time', 'idx_acc_no'],
        key: isPoor ? null : 'idx_status_time',
        key_length: isPoor ? null : '12',
        rows_examined_per_scan: explainBasics.explain_est_rows,
        rows_produced_per_join: Math.floor(explainBasics.explain_est_rows * 0.6),
        filtered: isPoor ? 12.5 : 90,
        cost_info: {
          read_cost: String((explainBasics.explain_top_cost * 0.6).toFixed(2)),
          eval_cost: String((explainBasics.explain_top_cost * 0.4).toFixed(2)),
        },
        used_columns: ['acc_no', 'acc_status', 'update_time', 'balance_amt'],
        attached_condition: "(`b`.`acc_status` = '1' AND `b`.`update_time` >= <cache>(date_sub(now(),interval 30 day)))",
      },
    },
  }

  // 表级评级 + 索引矩阵
  const indexBank = [
    { name: 'PRIMARY', cols: ['id'], primary: true, unique: true },
    { name: 'idx_status_time', cols: ['acc_status', 'update_time'] },
    { name: 'idx_acc_no', cols: ['acc_no'], unique: true },
    { name: 'idx_create_time', cols: ['create_time'] },
    { name: 'idx_tenant_status', cols: ['tenant_id', 'acc_status'] },
  ]

  const tableRatings = tables.map((t, i) => {
    const tRng = mulberry32(0xBEEF + i + (it.id || 0))
    // 每张表 2~4 个索引
    const idxCount = 2 + Math.floor(tRng() * 3)
    const availableIndexes = []
    for (let k = 0; k < idxCount; k++) {
      const seed = indexBank[(i + k) % indexBank.length]
      availableIndexes.push({
        indexName: seed.name + (k > 0 ? `_v${k}` : ''),
        columns: seed.cols,
        primary: !!seed.primary && k === 0,
        unique: !!seed.unique,
      })
    }
    // 命中规则：第一张表 + 非 POOR → 命中第二个索引；POOR / 其他表 → 不命中
    let matchedIndex = null
    let rating = 'GOOD'
    let reason = '索引覆盖度良好'
    if (i === 0 && !isPoor && availableIndexes[1]) {
      matchedIndex = {
        indexName: availableIndexes[1].indexName,
        matchedColumnCount: 1,
        totalColumnCount: availableIndexes[1].columns.length,
      }
      rating = 'GOOD'
      reason = `命中 ${matchedIndex.indexName}（${matchedIndex.matchedColumnCount}/${matchedIndex.totalColumnCount} 列）`
    } else if (isPoor && i === 0) {
      rating = 'POOR'
      reason = '过滤条件未命中任何索引，触发全表扫描'
    } else {
      rating = i === 0 ? 'GOOD' : 'EXCELLENT'
      reason = '该表参与 JOIN，按主键访问'
    }
    return { table: t, rating, reason, availableIndexes, matchedIndex }
  })

  // 警告
  const warnings = []
  if (isPoor) warnings.push('当前查询估算扫描行数 > 5w，建议优先治理')
  if (disagreement) warnings.push('规则引擎与运行时 EXPLAIN 评级不一致，请重点复核')
  if (llmHasFindings && (it.llm_confidence === 'LOW' || it.llm_confidence === 'MEDIUM')) {
    warnings.push(`LLM 置信度 ${it.llm_confidence} 偏低，建议人工复核 AI 建议`)
  }

  return {
    ...it,
    runtime_rating: runtimeRating,
    disagreement: disagreement ? 1 : 0,
    disagreement_reason: disagreementReason,
    ...explainBasics,
    explain_plan: explainPlan,
    table_ratings_json: JSON.stringify(tableRatings),
    warnings_json: JSON.stringify(warnings),
  }
}

function safeParseLen(json) {
  try { return JSON.parse(json).length } catch { return 0 }
}

// ────────────── 工具：响应封装 ──────────────

function ok(res, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = 200
  res.end(JSON.stringify({ code: 200, message: 'ok', data }))
}

function parseQuery(url) {
  const i = url.indexOf('?')
  if (i < 0) return {}
  const q = url.slice(i + 1)
  const out = {}
  for (const part of q.split('&')) {
    if (!part) continue
    const [k, v = ''] = part.split('=')
    const key = decodeURIComponent(k)
    const value = decodeURIComponent(v.replace(/\+/g, ' '))
    if (out[key] === undefined) out[key] = value
    else out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value]
  }
  return out
}

const REPLAY_GROUPS = ['公共组', '存款组', '贷款组', '结算组']
const REPLAY_ISSUE_DOMAINS = ['存款组', '贷款组', '公共组', '结算组', '迁移组', '平台组']
const REPLAY_STATISTICS_ISSUE_DOMAINS = [...REPLAY_GROUPS, '迁移组', '平台组']
const REPLAY_LEVELS = ['交易级', '字段级', '系统级']
const REPLAY_TYPES = ['迁移问题', '防腐问题', '代码问题', '新核心下线', '参数问题', '平台问题', '合理差异', '规则性差异问题', '外围问题', '其他问题']
const REPLAY_STATUSES = ['新建', '打开', '无需处理', '延后修复', '修复待验证', '重新打开', '已修复']
const REPLAY_NO_ACTION_TYPES = new Set(['合理差异', '规则性差异问题', '外围问题'])
const REPLAY_DEVELOPERS = ['张三(c-zhangs3)', '李四(c-lisi)', '王五(c-wangw5)', '赵六(c-zhaol6)']
function replayGroupSummaries(groups) {
  return groups.map((groupName, index) => {
  const newCount = 5 + (index % 7)
  const openCount = 12 + (index % 11)
  const deferredCount = 3 + (index % 5)
  const reopenedCount = 2 + (index % 4)
  const pendingVerificationCount = 4 + (index % 6)
  const pendingTotalCount = newCount + openCount + reopenedCount + deferredCount + pendingVerificationCount
  const noActionCount = 1 + (index % 3)
  const fixedCount = 6 + (index % 8)
  const fixedTotalCount = noActionCount + fixedCount
  return {
    groupName,
    newCount,
    openCount,
    reopenedCount,
    deferredCount,
    pendingVerificationCount,
    pendingTotalCount,
    noActionCount,
    fixedCount,
    fixedTotalCount,
    totalCount: pendingTotalCount + fixedTotalCount,
  }
  })
}
const REPLAY_GROUP_SUMMARIES = replayGroupSummaries(REPLAY_GROUPS)
const REPLAY_ISSUE_DOMAIN_GROUP_SUMMARIES = replayGroupSummaries(REPLAY_STATISTICS_ISSUE_DOMAINS)

function replayPersonRankings(groups) {
  const rows = Array.from({ length: 30 }, (_, index) => {
  const newCount = 2 + (index % 6)
  const openCount = 7 + (index % 13)
  const deferredCount = 1 + (index % 5)
  const reopenedCount = index % 4
  const pendingVerificationCount = 2 + (index % 7)
  const pendingTotalCount = newCount + openCount + reopenedCount + deferredCount + pendingVerificationCount
  const noActionCount = index % 3
  const fixedCount = 3 + (index % 9)
  const fixedTotalCount = noActionCount + fixedCount
  return {
    rank: Math.floor(index / groups.length) + 1,
    groupName: groups[index % groups.length],
    developer: `开发负责人${String(index + 1).padStart(2, '0')}(c-dev${String(index + 1).padStart(2, '0')})`,
    newCount,
    openCount,
    reopenedCount,
    deferredCount,
    pendingVerificationCount,
    pendingTotalCount,
    noActionCount,
    fixedCount,
    fixedTotalCount,
    totalCount: pendingTotalCount + fixedTotalCount,
  }
  })
  const nextRankByGroup = new Map()
  return rows
    .sort((left, right) => groups.indexOf(left.groupName) - groups.indexOf(right.groupName)
      || right.pendingTotalCount - left.pendingTotalCount
      || right.totalCount - left.totalCount
      || left.developer.localeCompare(right.developer, 'zh-CN'))
    .map((row) => {
      const rank = (nextRankByGroup.get(row.groupName) || 0) + 1
      nextRankByGroup.set(row.groupName, rank)
      return { ...row, rank }
    })
}
const REPLAY_PERSON_RANKINGS = replayPersonRankings(REPLAY_GROUPS)
const REPLAY_ISSUE_DOMAIN_PERSON_RANKINGS = replayPersonRankings(REPLAY_ISSUE_DOMAINS)

function replayStatistics(groupBy, replayType = 'ALL') {
  const rows = replayIssueGroupSummaries({ groupBy, replayType })
  const groupCounts = Object.fromEntries(rows.map(row => [row.groupName, {
    total: row.totalCount,
    new: row.newCount,
    open: row.openCount,
    reopened: row.reopenedCount,
    deferred: row.deferredCount,
    pendingVerification: row.pendingVerificationCount,
    noAction: row.noActionCount,
    fixed: row.fixedCount,
  }]))
  const sum = key => rows.reduce((total, row) => total + Number(row[key] || 0), 0)
  return {
    total: sum('totalCount'),
    newTotal: sum('newCount'),
    openTotal: sum('openCount'),
    reopenedTotal: sum('reopenedCount'),
    deferredTotal: sum('deferredCount'),
    noActionTotal: sum('noActionCount'),
    pendingVerificationTotal: sum('pendingVerificationCount'),
    fixedTotal: sum('fixedCount'),
    groupCounts,
  }
}
const SPLIT_FILTER_COLUMNS = new Set(['occurrence_rounds', 'matched_developer', 'matched_bank_owner'])
const REPLAY_LONG_TRANSACTION_NAME = '跨渠道账户余额与可用余额组合查询交易，覆盖人民币与外币、多币种子账户、冻结金额、透支额度、钞汇标志、账户状态、开户机构、客户等级、产品代码、渠道来源、请求流水和全局流水等完整业务上下文，用于验证筛选候选内容超长时仍保持单行展示并能够通过横向滚动查看全部交易名称信息，同时保留手机银行、网上银行、柜面、自助设备、开放银行和批量渠道的差异化描述与完整核对备注。'
const REPLAY_LONG_FIELD_NAME = 'responseBody.accountDetailList[*].multiCurrencyBalance.availableAmountAndFrozenAmountAndOverdraftLimitAndCashRemittanceFlagAndAccountStatusAndOpeningBranchAndCustomerLevelAndProductCodeAndChannelSourceAndRequestSerialNumberAndGlobalSerialNumber'
const REPLAY_LONG_ISSUE_DESCRIPTION = '超长问题描述演示：新核心与旧核心在账户余额、可用余额、冻结金额、透支额度、币种、钞汇标志、账户状态、开户机构、客户等级、产品代码、渠道来源、请求流水和全局流水等字段上存在组合差异，需要逐项核对字段映射、默认值、空值转换、金额精度、字符编码和响应码处理规则，并结合上下游服务日志与数据库快照确认真实原因，最终完成回放验证。'
const REPLAY_LONG_ISSUE_KEY = 'TC-ACCOUNT-QUERY|responseBody.accountDetailList[*].multiCurrencyBalance.availableAmountAndFrozenAmountAndOverdraftLimitAndCashRemittanceFlagAndAccountStatusAndOpeningBranchAndCustomerLevelAndProductCodeAndChannelSourceAndRequestSerialNumberAndGlobalSerialNumber|NEW_CORE_VS_OLD_CORE'
const REPLAY_HEADER_FILTER_FIELDS = {
  groupName: 'domain', issueDomain: 'issue_domain', sandbox: 'is_sandbox', issueId: 'issue_id', transactionCode: 'transaction_code',
  transactionName: 'transaction_name', issueLevel: 'issue_level', fieldName: 'field_name',
  serialNo: 'serial_no', globalSerialNo: 'global_serial_no', issueDescription: 'issue_description',
  defectRepairDate: 'defect_repair_date', developer: 'matched_developer', bankOwner: 'matched_bank_owner',
  issueStatus: 'issue_status', issueType: 'issue_type', cooperationPerson: 'cooperation_person_username',
  plannedCompletionDate: 'planned_completion_date', issueKey: 'issue_key', occurrenceBatch: 'occurrence_rounds',
}
const REPLAY_HEADER_FILTER_PARAMS = {
  groupName: 'groupNames', issueDomain: 'issueDomains', sandbox: 'sandboxes', issueId: 'issueIds', transactionCode: 'transactionCodes',
  transactionName: 'transactionNames', issueLevel: 'issueLevels', fieldName: 'fieldNames', serialNo: 'serialNos',
  globalSerialNo: 'globalSerialNos', issueDescription: 'issueDescriptions', defectRepairDate: 'defectRepairDates',
  developer: 'developers', bankOwner: 'bankOwners', issueStatus: 'issueStatuses', issueType: 'issueTypes',
  cooperationPerson: 'cooperationPersons', plannedCompletionDate: 'plannedCompletionDates', issueKey: 'issueKeys',
  occurrenceBatch: 'occurrenceBatches',
}
function splitFilterValues(value) {
  return String(value || '').split('、').map(v => v.trim()).filter(Boolean)
}
function isEmptyFilterValue(value) {
  return value === null || value === undefined || String(value).trim() === ''
}
function filterValueMatches(rowValue, selected) {
  return selected === '空' ? isEmptyFilterValue(rowValue) : String(rowValue ?? '').trim() === selected
}
const REPLAY_ISSUES = Array.from({ length: 100 }, (_, index) => {
  const n = index + 1
  const groupName = REPLAY_GROUPS[index % REPLAY_GROUPS.length]
  const transactionName = index < 15
    ? '账户余额与可用余额组合查询'
    : index % 19 === 0 ? ''
      : index % 17 === 0 ? REPLAY_LONG_TRANSACTION_NAME : `回放交易场景${(index % 8) + 1}`
  const fieldName = index % 20 === 0
    ? ''
    : index % 13 === 0 ? REPLAY_LONG_FIELD_NAME : ['响应码', '账户状态', '可用余额', '币种'][index % 4]
  const issueDescription = index < 5
    ? ''
    : index < 10 ? '新老核心账户余额与可用余额字段比对不一致，需要结合响应码、币种、钞汇标志和账户状态继续排查'
      : index < 15 ? REPLAY_LONG_ISSUE_DESCRIPTION
        : index % 22 === 0 ? '' : index % 17 === 0 ? REPLAY_LONG_ISSUE_DESCRIPTION : `回放问题描述分类${(index % 6) + 1}`
  const issueKey = index % 21 === 0
    ? ''
    : index % 16 === 0 ? REPLAY_LONG_ISSUE_KEY : `MOCK-SHARED-${String((index % 10) + 1).padStart(2, '0')}`
  const occurrenceBatches = index % 4 === 0 ? ['RPT20260819-001']
    : index % 4 === 1 ? ['DZ20260819-001']
      : index % 4 === 2 ? ['RPT20260815-001', 'DZ20260815-001'] : ['MOCK-20260812']
  if (index > 0 && index % 10 === 0) occurrenceBatches.push('MOCK-20260808')
  const affectedTransactionCount = ['10', '2', '1', '', 'bad'][index]
    ?? String(((index * 7) % 18) + 1)
  return {
    id: n, domain: groupName, group_name: groupName, issue_id: String(2900 + n), is_sandbox: false,
    issue_domain: REPLAY_ISSUE_DOMAINS[index % REPLAY_ISSUE_DOMAINS.length],
    issue_domain_transfer_count: index % 4,
    transaction_code: `E${String(810 + (index % 24)).padStart(3, '0')}`, transaction_name: transactionName,
    issue_level: REPLAY_LEVELS[index % REPLAY_LEVELS.length], field_name: fieldName, serial_no: `10150160${String(n).padStart(8, '0')}`,
    global_serial_no: `GS-${String(n).padStart(8, '0')}`, issue_description: issueDescription,
    matched_developer: index % 10 === 0 ? '' : (index % 5 === 0 ? '张三(c-zhangs3)、李四(c-lisi)' : REPLAY_DEVELOPERS[index % REPLAY_DEVELOPERS.length]),
    matched_bank_owner: index % 12 === 0 ? null : (index % 6 === 0 ? '刘六(c-liul6)、王七(c-wangq7)' : '行方负责人'),
    issue_status: REPLAY_STATUSES[index % REPLAY_STATUSES.length], issue_type: REPLAY_TYPES[index % REPLAY_TYPES.length],
    initial_analysis: `初步分析：已定位第${n}条问题的响应码与字段映射差异`,
    final_solution: `最终方案：调整第${n}条交易映射并完成回放验证`,
    cooperation_person_username: '', cooperation_person_real_name: '',
    remark: index % 3 === 0 ? `备注：第${n}条问题需要关注后续批次验证结果` : `备注：第${n}条问题已纳入跟踪`,
    batch_no: 'MOCK-20260812', import_date: '2026-08-12', registered_date: '2026-08-12',
    planned_completion_date: groupName === '公共组' ? (index % 8 === 0 ? '2026-08-26' : '')
      : groupName === '贷款组' ? (index % 8 === 2 ? '2026-09-10' : '') : '',
    defect_repair_date: index % 5 === 0 ? `2026-08-${String(20 + (index % 8)).padStart(2, '0')}` : '',
    affected_transaction_count: affectedTransactionCount, issue_key: issueKey, historical_occurrence_count: 1,
    first_occurrence_date: '2026-08-12', last_occurrence_date: '2026-08-19', occurrence_rounds: occurrenceBatches.join('、'),
  }
})
const REPLAY_ISSUE_DOMAIN_TRANSFERS = new Map(REPLAY_ISSUES.map((issue) => {
  const count = Number(issue.issue_domain_transfer_count) || 0
  const currentIndex = REPLAY_ISSUE_DOMAINS.indexOf(issue.issue_domain)
  const items = Array.from({ length: count }, (_, index) => {
    const toIndex = (currentIndex - index + REPLAY_ISSUE_DOMAINS.length) % REPLAY_ISSUE_DOMAINS.length
    const fromIndex = (toIndex - 1 + REPLAY_ISSUE_DOMAINS.length) % REPLAY_ISSUE_DOMAINS.length
    return {
      fromDomain: REPLAY_ISSUE_DOMAINS[fromIndex],
      toDomain: REPLAY_ISSUE_DOMAINS[toIndex],
      operatorUsername: `c-mock${index + 1}`,
      operatorRealName: `Mock操作员${index + 1}`,
      transferredAt: `2026-08-${String(29 - index).padStart(2, '0')} ${String(17 - index).padStart(2, '0')}:08:09`,
    }
  })
  return [issue.id, items]
}))
const REPLAY_PLAN_DATE_CHANGES = new Map([
  [2, [
    { plannedCompletionDate: '2026-08-18', operatorUsername: 'c-mock-current', operatorRealName: '当前Mock用户', changedAt: '2026-08-31 17:09:09' },
    { plannedCompletionDate: null, operatorUsername: 'c-lisi', operatorRealName: '李四', changedAt: '2026-08-30 14:09:09' },
    { plannedCompletionDate: '2026-08-17', operatorUsername: 'c-zhangs', operatorRealName: '张三', changedAt: '2026-08-29 10:08:09' },
  ]],
  [4, [
    { plannedCompletionDate: '2026-08-19', operatorUsername: 'c-wangw', operatorRealName: '王五', changedAt: '2026-08-28 09:08:09' },
  ]],
])
REPLAY_PLAN_DATE_CHANGES.forEach((items, issueId) => {
  const issue = REPLAY_ISSUES.find(item => item.id === issueId)
  if (!issue) return
  issue.planned_completion_date = items[0]?.plannedCompletionDate || ''
  issue.planned_completion_date_change_count = items.length
})
REPLAY_ISSUES.forEach((issue) => {
  if (issue.planned_completion_date_change_count == null) issue.planned_completion_date_change_count = 0
})
let replayPlanDateChangeSequence = 0
const REPLAY_MAIL_STATUS = new Map()
let REPLAY_WEEKLY_TASK_BATCHES = ['RPT20260819-001']
const REPLAY_AVAILABLE_BATCHES = ['DZ20260815-001', 'DZ20260819-001', 'MOCK-20260808', 'MOCK-20260812', 'RPT20260815-001', 'RPT20260819-001']
const REPLAY_DAILY_REPORT_BATCHES = [
  { batchNo: 'RPT20260903-01', family: 'RPT', importedAt: '2026-09-03T10:00:00', previousBatchNo: 'RPT20260902-01', canGenerate: true },
  { batchNo: 'RPT20260902-01', family: 'RPT', importedAt: '2026-09-02T10:00:00', previousBatchNo: 'RPT20260901-01', canGenerate: true },
  { batchNo: 'RPT20260901-01', family: 'RPT', importedAt: '2026-09-01T10:00:00', previousBatchNo: null, canGenerate: false },
  { batchNo: 'RPT20260825-01', family: 'RPT', importedAt: '2026-08-25T10:00:00', previousBatchNo: 'RPT20260818-01', canGenerate: true },
  { batchNo: 'RPT20260818-01', family: 'RPT', importedAt: '2026-08-18T10:00:00', previousBatchNo: null, canGenerate: false },
  { batchNo: 'DZ20260902-01', family: 'DZ', importedAt: '2026-09-02T11:00:00', previousBatchNo: 'DZ20260820-01', canGenerate: true },
  { batchNo: 'DZ20260820-01', family: 'DZ', importedAt: '2026-08-20T11:00:00', previousBatchNo: null, canGenerate: false },
]

function replayIssueRoundTracking(issueId) {
  const issue = REPLAY_ISSUES.find(item => item.id === issueId) || REPLAY_ISSUES[0]
  const longValue = 'responseBody.accountDetailList[*].multiCurrencyBalance.availableAmountAndFrozenAmountAndOverdraftLimitAndCashRemittanceFlag'
  const originalData = [
    { field: 'issue_id', value: issue.issue_id || '000845' },
    { field: '是否沙箱', value: issue.sandbox ? '是' : '否' },
    { field: '交易码', value: issue.transaction_code || '6208' },
    { field: '交易名称', value: issue.transaction_name || '对公贷款还款计划查询' },
    { field: '问题级别', value: issue.issue_level || '交易级' },
    { field: '字段名', value: longValue },
    { field: '流水号', value: issue.serial_no || '001012213710102' },
    { field: '全局流水号', value: issue.global_serial_no || 'GS-00000059' },
    { field: '问题描述', value: '本批次导入内容与当前记录一致' },
    { field: '领域', value: issue.group_name || '贷款组' },
    { field: '出现笔数', value: '58' },
    { field: 'issue_key', value: issue.issue_key || 'TRAN|6208|响应码' },
    { field: '首次出现日期', value: '2026-07-28' },
  ]
  return [
    {
      roundId: 4,
      roundCode: 'RPT20260820-001',
      importedAt: '2026-08-20 10:00:00',
      appeared: false,
      statusBefore: '修复待验证',
      statusAfter: '已修复',
      actionType: '问题自动修复',
      manualChangeCount: 0,
      finalStatus: '已修复',
      originalData: [],
      inheritedEvents: [{
        id: 401,
        operationType: '问题自动修复',
        operationAt: '2026-08-20 10:00:00',
        operatorRealName: '系统',
        operatorUsername: 'SYSTEM',
        changes: [{ field: '问题状态', before: '修复待验证', after: '已修复' }],
      }],
      manualEvents: [],
    },
    {
      roundId: 3,
      roundCode: 'RPT20260819-001',
      importedAt: '2026-08-19 10:00:00',
      appeared: true,
      statusBefore: '修复待验证',
      statusAfter: '修复待验证',
      actionType: '导入',
      manualChangeCount: 0,
      finalStatus: '修复待验证',
      originalData,
      inheritedEvents: [],
      manualEvents: [],
    },
    {
      roundId: 2,
      roundCode: 'MOCK-20260812',
      importedAt: '2026-08-12 10:00:00',
      appeared: true,
      statusBefore: '打开',
      statusAfter: '修复待验证',
      actionType: '基础数据覆盖，人工内容继承',
      manualChangeCount: 1,
      finalStatus: '已修复',
      originalData,
      inheritedEvents: [],
      manualEvents: [{
        id: 301,
        operationType: '人工保存',
        operationAt: '2026-08-12 14:30:00',
        operatorRealName: '当前Mock用户',
        operatorUsername: 'c-mock-current',
        changes: [{ field: '问题状态', before: '修复待验证', after: '已修复' }],
      }],
    },
    {
      roundId: 1,
      roundCode: 'MOCK-20260808',
      importedAt: '2026-08-08 09:00:00',
      appeared: true,
      statusBefore: '新建',
      statusAfter: '打开',
      actionType: '导入',
      manualChangeCount: 0,
      finalStatus: '打开',
      originalData,
      inheritedEvents: [{
        id: 101,
        operationType: '导入',
        operationAt: '2026-08-08 09:00:00',
        operatorRealName: '系统',
        operatorUsername: 'SYSTEM',
        changes: [{ field: '问题状态', before: '新建', after: '打开' }],
      }],
      manualEvents: [],
    },
  ]
}

const REPLAY_COMPLETION_DEVELOPERS = Array.from(
  { length: 50 },
  (_, index) => `开发负责人${String(index + 1).padStart(2, '0')}(c-dev${String(index + 1).padStart(2, '0')})`,
)
const REPLAY_COMPLETION_DEVELOPER_INDEXES = Array.from(
  { length: 100 },
  (_, index) => index < REPLAY_COMPLETION_DEVELOPERS.length
    ? index
    : (index - REPLAY_COMPLETION_DEVELOPERS.length) % 10,
)
const REPLAY_COMPLETION_DATES = Array.from(
  { length: 36 },
  (_, index) => index < 31
    ? `2026-08-${String(index + 1).padStart(2, '0')}`
    : `2026-09-${String(index - 30).padStart(2, '0')}`,
)
const REPLAY_COMPLETION_TODAY = '2026-09-02'
const REPLAY_COMPLETION_ISSUES = REPLAY_GROUPS.flatMap((groupName, groupIndex) =>
  Array.from({ length: REPLAY_COMPLETION_DEVELOPER_INDEXES.length }, (_, index) => {
    const categoryIndex = index % 4
    const plannedDateIndex = groupIndex === 0
      ? index % REPLAY_COMPLETION_DATES.length
      : (index * (groupIndex + 2) + groupIndex) % REPLAY_COMPLETION_DATES.length
    const plannedCompletionDate = REPLAY_COMPLETION_DATES[plannedDateIndex]
    const plannedTime = new Date(`${plannedCompletionDate}T00:00:00Z`)
    const repaired = new Date(plannedTime)
    if (categoryIndex === 0) repaired.setUTCDate(repaired.getUTCDate() - 1)
    if (categoryIndex === 1) repaired.setUTCDate(repaired.getUTCDate() + 3)
    const defectRepairDate = categoryIndex < 2 ? repaired.toISOString().slice(0, 10) : null
    const id = 5000 + groupIndex * REPLAY_COMPLETION_DEVELOPER_INDEXES.length + index + 1
    return {
      id,
      issueId: `MOCK-C-${String(id).padStart(5, '0')}`,
      transactionCode: `C${groupIndex + 1}${String(index + 1).padStart(3, '0')}`,
      transactionName: `${groupName}计划完成跟踪交易${index + 1}`,
      issueStatus: defectRepairDate ? '已修复' : (index % 3 === 0 ? '修复待验证' : '打开'),
      plannedCompletionDate,
      defectRepairDate,
      groupName,
      issueDomain: REPLAY_ISSUE_DOMAINS[(groupIndex * 30 + index) % REPLAY_ISSUE_DOMAINS.length],
      matchedDeveloper: REPLAY_COMPLETION_DEVELOPERS[
        (REPLAY_COMPLETION_DEVELOPER_INDEXES[index] + groupIndex) % REPLAY_COMPLETION_DEVELOPERS.length
      ],
      issueKey: `MOCK-COMPLETION-${groupIndex + 1}-${String(index + 1).padStart(2, '0')}`,
      occurrenceBatches: index % 4 === 0 ? ['RPT20260819-001']
        : index % 4 === 1 ? ['DZ20260819-001']
          : index % 4 === 2 ? ['RPT20260815-001', 'DZ20260815-001'] : ['MOCK-20260812'],
    }
  }),
)

function replayCompletionCategory(issue, today = REPLAY_COMPLETION_TODAY) {
  if (issue.defectRepairDate) return issue.defectRepairDate <= issue.plannedCompletionDate ? 'ON_TIME_FIXED' : 'LATE_FIXED'
  return today <= issue.plannedCompletionDate ? 'UNFINISHED' : 'OVERDUE_UNFINISHED'
}

function replayCompletionCounts(rows) {
  const counts = {
    onTimeFixedCount: 0,
    lateFixedCount: 0,
    unfinishedCount: 0,
    overdueUnfinishedCount: 0,
    pendingVerificationCount: 0,
  }
  const fieldByCategory = {
    ON_TIME_FIXED: 'onTimeFixedCount',
    LATE_FIXED: 'lateFixedCount',
    UNFINISHED: 'unfinishedCount',
    OVERDUE_UNFINISHED: 'overdueUnfinishedCount',
  }
  rows.forEach((issue) => {
    counts[fieldByCategory[replayCompletionCategory(issue)]] += 1
    if (!issue.defectRepairDate && issue.issueStatus === '修复待验证') counts.pendingVerificationCount += 1
  })
  const plannedTotal = rows.length
  const completionRate = plannedTotal ? Number((((counts.onTimeFixedCount + counts.lateFixedCount) * 100) / plannedTotal).toFixed(2)) : null
  return { plannedTotal, ...counts, completionRate }
}

function replayCompletionRange(q) {
  const shiftDate = (date, days) => {
    const value = new Date(`${date}T00:00:00Z`)
    value.setUTCDate(value.getUTCDate() + days)
    return value.toISOString().slice(0, 10)
  }
  const defaultStartDate = shiftDate(REPLAY_COMPLETION_TODAY, -1)
  const defaultEndDate = shiftDate(REPLAY_COMPLETION_TODAY, 1)
  const datePoints = [...new Set([
    ...REPLAY_COMPLETION_ISSUES.map(issue => issue.plannedCompletionDate),
    defaultStartDate, REPLAY_COMPLETION_TODAY, defaultEndDate,
  ])].sort()
  if (!q.startDate && !q.endDate) {
    return { datePoints, startDate: defaultStartDate, endDate: defaultEndDate, defaultStartDate, defaultEndDate }
  }
  const startDate = q.startDate
    ? (datePoints.find(date => date >= q.startDate) || datePoints.at(-1))
    : datePoints[0]
  const endDate = q.endDate
    ? ([...datePoints].reverse().find(date => date <= q.endDate) || datePoints[0])
    : datePoints.at(-1)
  return { datePoints, startDate, endDate, defaultStartDate, defaultEndDate }
}

function replayCompletionDashboard(q) {
  const { startDate, endDate } = replayCompletionRange(q)
  const rangeRows = REPLAY_COMPLETION_ISSUES.filter(issue => issue.plannedCompletionDate >= startDate
    && issue.plannedCompletionDate <= endDate && matchesReplayType(issue, q.replayType))
  const groupField = q.groupBy === 'issueDomain' ? 'issueDomain' : 'groupName'
  const groupNames = q.groupBy === 'issueDomain' ? [...REPLAY_GROUPS, '迁移组', '平台组'] : REPLAY_GROUPS
  const groups = groupNames.map(groupName => {
    const groupRows = rangeRows.filter(issue => issue[groupField] === groupName)
    const developers = [...new Set(groupRows.map(issue => issue.matchedDeveloper))].map(matchedDeveloper => ({
      matchedDeveloper,
      ...replayCompletionCounts(groupRows.filter(issue => issue.matchedDeveloper === matchedDeveloper)),
    })).sort((left, right) => {
      const leftRate = left.completionRate == null ? Number.POSITIVE_INFINITY : Number(left.completionRate)
      const rightRate = right.completionRate == null ? Number.POSITIVE_INFINITY : Number(right.completionRate)
      return leftRate - rightRate
        || Number(right.plannedTotal || 0) - Number(left.plannedTotal || 0)
        || String(left.matchedDeveloper || '').localeCompare(String(right.matchedDeveloper || ''), 'zh-CN')
    })
    return { groupName, ...replayCompletionCounts(groupRows), developers }
  })
  return {
    effectiveStartDate: startDate,
    effectiveEndDate: endDate,
    today: REPLAY_COMPLETION_TODAY,
    summary: replayCompletionCounts(rangeRows),
    groups,
  }
}

function isReplayWeeklyTask(row) {
  return splitFilterValues(row.occurrence_rounds).some(batch => REPLAY_WEEKLY_TASK_BATCHES.includes(batch))
}

function replayWeeklyTaskConfig() {
  return {
    batchNames: [...REPLAY_WEEKLY_TASK_BATCHES],
    availableBatchNames: [...REPLAY_AVAILABLE_BATCHES],
    issueCount: REPLAY_ISSUES.filter(isReplayWeeklyTask).length,
  }
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) } catch { resolve({}) }
    })
  })
}

function replayFilterRows(q) {
  let rows = REPLAY_ISSUES.filter(row => matchesReplayType(row, q.replayType))
  if (q.weeklyTask === 'true' || q.weeklyTask === true) rows = rows.filter(isReplayWeeklyTask)
  if (q.groupName) rows = rows.filter(r => r.domain === q.groupName)
  if (q.issueId) rows = rows.filter(r => String(r.issue_id || '').includes(q.issueId))
  if (q.issueLevel) rows = rows.filter(r => r.issue_level === q.issueLevel)
  if (q.issueStatus) rows = rows.filter(r => r.issue_status === q.issueStatus)
  if (q.issueType) rows = rows.filter(r => r.issue_type === q.issueType)
  if (q.serialNo) rows = rows.filter(r => String(r.serial_no || '').includes(q.serialNo))
  if (q.globalSerialNo) rows = rows.filter(r => String(r.global_serial_no || '').includes(q.globalSerialNo))
  if (q.defectRepairDate) rows = rows.filter(r => String(r.defect_repair_date || '') === q.defectRepairDate)
  if (q.occurrenceBatches) {
    const values = Array.isArray(q.occurrenceBatches) ? q.occurrenceBatches : [q.occurrenceBatches]
    rows = rows.filter(r => values.some(value => value === '空' ? isEmptyFilterValue(r.occurrence_rounds) : splitFilterValues(r.occurrence_rounds).includes(value)))
  }
  const inFilter = (key, column) => {
    if (!q[key]) return
    const values = Array.isArray(q[key]) ? q[key] : [q[key]]
    rows = rows.filter(r => {
      const rawValue = column === 'issue_domain' ? (r.issue_domain || r.group_name) : r[column]
      const rowValues = SPLIT_FILTER_COLUMNS.has(column) ? splitFilterValues(rawValue) : [rawValue]
      return values.some(value => value === '空' ? isEmptyFilterValue(rawValue) : rowValues.includes(value))
    })
  }
  inFilter('transactionCodes', 'transaction_code')
  inFilter('transactionNames', 'transaction_name')
  inFilter('groupNames', 'domain')
  inFilter('issueDomains', 'issue_domain')
  inFilter('issueIds', 'issue_id')
  inFilter('issueLevels', 'issue_level')
  inFilter('fieldNames', 'field_name')
  inFilter('serialNos', 'serial_no')
  inFilter('globalSerialNos', 'global_serial_no')
  inFilter('issueDescriptions', 'issue_description')
  inFilter('defectRepairDates', 'defect_repair_date')
  inFilter('plannedCompletionDates', 'planned_completion_date')
  inFilter('developers', 'matched_developer')
  inFilter('bankOwners', 'matched_bank_owner')
  inFilter('issueStatuses', 'issue_status')
  inFilter('issueTypes', 'issue_type')
  inFilter('cooperationPersons', 'cooperation_person_username')
  inFilter('issueKeys', 'issue_key')
  if (q.sandboxes) {
    const values = Array.isArray(q.sandboxes) ? q.sandboxes : [q.sandboxes]
    rows = rows.filter(r => values.includes(r.is_sandbox ? '是' : '否'))
  }
  if (q.keyword) rows = rows.filter(r => Object.values(r).some(v => String(v || '').includes(q.keyword)))
  return rows
}

function matchesReplayType(row, replayType = 'ALL') {
  if (!replayType || replayType === 'ALL') return true
  const prefix = replayType === 'DZ' ? 'DZ' : replayType === 'QUERY' ? 'RPT' : ''
  if (!prefix) return false
  const batches = Array.isArray(row.occurrenceBatches)
    ? row.occurrenceBatches
    : splitFilterValues(row.occurrence_rounds)
  return batches.some(batch => String(batch).startsWith(prefix))
}

function replayIssueGroupSummaries(query = {}) {
  const groupField = query.groupBy === 'issueDomain' ? 'issue_domain' : 'group_name'
  const formalStatuses = new Set(['新建', '打开', '重新打开', '延后修复', '修复待验证', '无需处理', '已修复'])
  const rows = replayFilterRows({ replayType: query.replayType }).filter(row => formalStatuses.has(row.issue_status))
  const grouped = new Map()
  rows.forEach((row) => {
    const groupName = row[groupField] || row.group_name
    if (!grouped.has(groupName)) grouped.set(groupName, [])
    grouped.get(groupName).push(row)
  })
  return [...grouped.entries()].map(([groupName, groupRows]) => {
    const count = status => groupRows.filter(row => row.issue_status === status).length
    const newCount = count('新建')
    const openCount = count('打开')
    const reopenedCount = count('重新打开')
    const deferredCount = count('延后修复')
    const pendingVerificationCount = count('修复待验证')
    const noActionCount = count('无需处理')
    const fixedCount = count('已修复')
    return {
      groupName, newCount, openCount, reopenedCount, deferredCount, pendingVerificationCount,
      pendingTotalCount: newCount + openCount + reopenedCount + deferredCount + pendingVerificationCount,
      noActionCount, fixedCount, fixedTotalCount: noActionCount + fixedCount, totalCount: groupRows.length,
    }
  }).sort((left, right) => left.groupName.localeCompare(right.groupName, 'zh-CN'))
}

function replayIssuePersonRankings(query = {}) {
  const groupField = query.groupBy === 'issueDomain' ? 'issue_domain' : 'group_name'
  const grouped = new Map()
  replayFilterRows({ replayType: query.replayType }).forEach((row) => {
    const groupName = row[groupField] || row.group_name
    const developer = String(row.matched_developer || '').trim() || '未匹配负责人'
    const key = `${groupName}\u0000${developer}`
    if (!grouped.has(key)) grouped.set(key, { groupName, developer, rows: [] })
    grouped.get(key).rows.push(row)
  })
  const summaries = [...grouped.values()].map(({ groupName, developer, rows }) => {
    const summary = replayIssueGroupSummariesForRows(groupName, rows)
    return { groupName, developer, ...summary }
  }).sort((left, right) => left.groupName.localeCompare(right.groupName, 'zh-CN')
    || right.pendingTotalCount - left.pendingTotalCount || right.totalCount - left.totalCount
    || left.developer.localeCompare(right.developer, 'zh-CN'))
  const ranks = new Map()
  return summaries.map((row) => {
    const rank = (ranks.get(row.groupName) || 0) + 1
    ranks.set(row.groupName, rank)
    return { rank, ...row }
  })
}

function replayIssuePersonSchedule(query = {}) {
  const groupField = query.groupBy === 'issueDomain' ? 'issue_domain' : 'group_name'
  const scheduleRows = replayFilterRows({ replayType: query.replayType }).filter((row) => {
    const groupName = row[groupField] || row.group_name
    const developer = String(row.matched_developer || '').trim() || '未匹配负责人'
    return groupName === query.groupName
      && developer === query.developer
      && ['新建', '打开', '重新打开'].includes(row.issue_status)
  })
  const dateCountMap = new Map()
  scheduleRows.forEach((row) => {
    const date = String(row.planned_completion_date || '').trim()
    if (date) dateCountMap.set(date, (dateCountMap.get(date) || 0) + 1)
  })
  const dateCounts = [...dateCountMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([plannedCompletionDate, count]) => ({ plannedCompletionDate, count }))
  const schedulePlannedCount = dateCounts.reduce((sum, row) => sum + row.count, 0)
  return {
    groupName: query.groupName,
    developer: query.developer,
    scheduleTotalCount: scheduleRows.length,
    schedulePlannedCount,
    scheduleUnplannedCount: scheduleRows.length - schedulePlannedCount,
    dateCounts,
  }
}

function replayIssueGroupSummariesForRows(groupName, rows) {
  const count = status => rows.filter(row => row.issue_status === status).length
  const newCount = count('新建')
  const openCount = count('打开')
  const reopenedCount = count('重新打开')
  const deferredCount = count('延后修复')
  const pendingVerificationCount = count('修复待验证')
  const noActionCount = count('无需处理')
  const fixedCount = count('已修复')
  const scheduleRows = rows.filter(row => ['新建', '打开', '重新打开'].includes(row.issue_status))
  const schedulePlannedCount = scheduleRows.filter(row => String(row.planned_completion_date || '').trim()).length
  return { newCount, openCount, reopenedCount, deferredCount, pendingVerificationCount,
    pendingTotalCount: newCount + openCount + reopenedCount + deferredCount + pendingVerificationCount,
    schedulePlannedCount, scheduleTotalCount: scheduleRows.length,
    noActionCount, fixedCount, fixedTotalCount: noActionCount + fixedCount, totalCount: rows.length }
}

function replaySortRows(rows, query = {}) {
  const order = query.affectedTransactionCountOrder
  if (order !== 'ASC' && order !== 'DESC') return rows
  const numericValue = (row) => {
    const value = String(row.affected_transaction_count ?? '').trim()
    return /^\d+$/.test(value) ? Number(value) : null
  }
  return [...rows].sort((left, right) => {
    const leftValue = numericValue(left)
    const rightValue = numericValue(right)
    if (leftValue == null && rightValue == null) return left.id - right.id
    if (leftValue == null) return 1
    if (rightValue == null) return -1
    if (leftValue !== rightValue) return order === 'ASC' ? leftValue - rightValue : rightValue - leftValue
    return left.id - right.id
  })
}

function replayHeaderCandidateValues(row, field, column, replayType = 'ALL') {
  if (field === 'sandbox') return [row[column] ? '是' : '否']
  if (field === 'issueDomain') return [String(row.issue_domain || row.group_name).trim()]
  if (SPLIT_FILTER_COLUMNS.has(column)) {
    let values = splitFilterValues(row[column])
    if (field === 'occurrenceBatch' && replayType !== 'ALL') {
      const prefix = replayType === 'DZ' ? 'DZ' : 'RPT'
      values = values.filter(value => value.startsWith(prefix))
    }
    return values.length ? values : ['空']
  }
  return [isEmptyFilterValue(row[column]) ? '空' : String(row[column]).trim()]
}

export function replayHeaderFilterOptionCounts(query = {}) {
  const field = query.field
  const column = REPLAY_HEADER_FILTER_FIELDS[field]
  if (!column) return { candidateCount: 0, matchedIssueCount: 0, truncated: false, items: [] }

  const scopedQuery = { ...query }
  delete scopedQuery.keyword
  delete scopedQuery[REPLAY_HEADER_FILTER_PARAMS[field]]
  const counts = new Map()
  replayFilterRows(scopedQuery).forEach((row) => {
    replayHeaderCandidateValues(row, field, column, query.replayType).forEach((value) => {
      if (query.keyword && !value.includes(query.keyword)) return
      if (!counts.has(value)) counts.set(value, new Set())
      counts.get(value).add(row.id)
    })
  })

  const values = [...counts.keys()].sort((left, right) => {
    if (left === '空') return -1
    if (right === '空') return 1
    return left.localeCompare(right, 'zh-CN')
  })
  const truncated = values.length > 500
  const visibleValues = values.slice(0, 500)
  const matchedIssueIds = new Set([...counts.values()].flatMap(issueIds => [...issueIds]))
  return {
    candidateCount: visibleValues.length,
    matchedIssueCount: matchedIssueIds.size,
    truncated,
    items: visibleValues.map(value => ({ value, count: counts.get(value).size })),
  }
}

export function replayHeaderFilterOptions(query = {}) {
  return replayHeaderFilterOptionCounts(query).items.map(item => item.value)
}

const DB_COMPARE_VERSION_PREFIX = '/api/ai/parallel-replay/database-comparison-fields/versions'
const DB_COMPARE_DOMAINS = ['存款组', '贷款组', '公共组', '结算组', '平台组']
const DB_COMPARE_MODULES = {
  存款组: 'dept',
  贷款组: 'loan',
  公共组: 'comm',
  结算组: 'sett',
  平台组: 'platform',
}
const DB_COMPARE_PEOPLE = [
  { empNo: 'c-zhangs', name: '张三' },
  { empNo: 'c-lisi', name: '李四' },
  { empNo: 'c-wangwu', name: '王五' },
  { empNo: 'c-zhaoliu', name: '赵六' },
]

function buildDatabaseComparisonSnapshot(total, revision = 0) {
  return Array.from({ length: total }, (_, index) => {
    const domainName = DB_COMPARE_DOMAINS[index % DB_COMPARE_DOMAINS.length]
    const reviser = domainName === '存款组' ? DB_COMPARE_PEOPLE[0] : DB_COMPARE_PEOPLE[(index + revision) % DB_COMPARE_PEOPLE.length]
    const groupOwner = DB_COMPARE_PEOPLE[(index + 1 + revision) % DB_COMPARE_PEOPLE.length]
    const domainCode = ['deposit', 'loan', 'common', 'settlement', 'platform'][index % DB_COMPARE_DOMAINS.length]
    const number = String(index + 1).padStart(3, '0')
    const extraFields = Array.from({ length: 3 + ((index + revision) % 6) }, (_, fieldIndex) => ({
      columnName: ['customer_no', 'currency_cd', 'balance_amt', 'status_cd', 'branch_no', 'product_cd', 'updated_at', 'txn_sn'][fieldIndex],
      columnComment: ['客户号', '币种', '余额', '状态', '机构号', '产品代码', '更新时间', '交易流水'][fieldIndex],
      primaryKey: false,
      comparisonOrder: fieldIndex + 2,
    }))
    return {
      sourceRegistrationId: index + 1,
      sourceRegistrationVersion: revision + 1,
      tableName: `${domainCode}_replay_compare_${number}`,
      tableComment: `${domainName}回放比对快照表${number}`,
      domainName,
      reviserEmpNo: reviser.empNo,
      reviserName: reviser.name,
      groupOwnerEmpNo: groupOwner.empNo,
      groupOwnerName: groupOwner.name,
      registeredDate: `2026-09-${String(((index + revision) % 14) + 1).padStart(2, '0')}`,
      fields: [
        { columnName: 'acct_no', columnComment: '账号', primaryKey: true, comparisonOrder: 1 },
        ...extraFields,
      ],
    }
  })
}

function databaseComparisonVersionNo(date = new Date()) {
  const part = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}`
}

function databaseComparisonLocalDateTime(date = new Date()) {
  const part = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`
}

function databaseComparisonVersionSummary(versionNo, generatedName, generatedAt, snapshot, latest = false) {
  return {
    versionNo,
    generatedBy: generatedName === '系统' ? 'system' : 'c-mock-current',
    generatedName,
    generatedAt,
    tableCount: snapshot.length,
    fieldCount: snapshot.reduce((total, row) => total + row.fields.length, 0),
    latest,
  }
}

function escapeDatabaseComparisonSqlLiteral(value) {
  return String(value ?? '').replaceAll("'", "''")
}

function databaseComparisonInsert(tableName, columns, rows) {
  const batches = []
  for (let offset = 0; offset < rows.length; offset += 500) {
    batches.push(`INSERT INTO ${tableName} (${columns.join(',')}) VALUES\n${rows.slice(offset, offset + 500).join(',\n')};`)
  }
  return batches.join('\n')
}

function buildDatabaseComparisonConfigScript(version) {
  const sortedSnapshot = [...version.snapshot].sort((left, right) => (
    DB_COMPARE_DOMAINS.indexOf(left.domainName) - DB_COMPARE_DOMAINS.indexOf(right.domainName)
    || left.tableName.localeCompare(right.tableName, 'en', { sensitivity: 'base' })
  ))
  const confRows = []
  const fieldRows = []
  const tableSqlRows = []
  let fieldCount = 0
  sortedSnapshot.forEach((table, tableIndex) => {
    const bcompIndex = tableIndex + 1
    const tableName = escapeDatabaseComparisonSqlLiteral(table.tableName)
    const tableMemoBase = String(table.tableComment || table.tableName)
    const tableMemo = escapeDatabaseComparisonSqlLiteral(
      tableMemoBase.endsWith('比对') ? tableMemoBase : `${tableMemoBase}比对`,
    )
    confRows.push(`(${bcompIndex},'${DB_COMPARE_MODULES[table.domainName]}','${tableName}','${tableMemo}','2','1','3','1')`)
    const fields = [...table.fields].sort((left, right) => left.comparisonOrder - right.comparisonOrder)
    fields.forEach((field, fieldIndex) => {
      const fieldName = escapeDatabaseComparisonSqlLiteral(field.columnName)
      const fieldMemo = escapeDatabaseComparisonSqlLiteral(field.columnComment || field.columnName)
      const fieldOrder = fieldIndex + 1
      fieldRows.push(`(${bcompIndex},'${fieldName}','1','${fieldMemo}','${fieldOrder}','${fieldOrder}','${field.primaryKey ? '1' : '0'}','0')`)
    })
    fieldCount += fields.length
    const selectFields = fields.map(field => field.columnName).join(',')
    const selectSql = `(select ${selectFields} from ${table.tableName})`
    tableSqlRows.push(`(${bcompIndex},'${selectSql} orig',1,'${selectSql} dest',2)`)
  })
  const sql = [
    'START TRANSACTION;',
    'TRUNCATE TABLE tss_bcomp_field;',
    'TRUNCATE TABLE tss_bcomp_table_sql;',
    'TRUNCATE TABLE tss_bcomp_conf;',
    databaseComparisonInsert(
      'tss_bcomp_conf',
      ['bcomp_index', 'bcomp_module', 'bcomp_name', 'bcomp_memo', 'bcomp_type', 'bcomp_range', 'bcomp_time_node', 'bcomp_state'],
      confRows,
    ),
    databaseComparisonInsert(
      'tss_bcomp_field',
      ['bcomp_index', 'field_name', 'field_type', 'field_memo', 'field_old_index', 'field_new_index', 'field_index_flag', 'field_enum_flag'],
      fieldRows,
    ),
    databaseComparisonInsert(
      'tss_bcomp_table_sql',
      ['bcomp_index', 'orig_sql', 'orig_database_id', 'dest_sql', 'dest_database_id'],
      tableSqlRows,
    ),
    'COMMIT;',
    `-- 版本号：${version.summary.versionNo}`,
    `-- 表数：${sortedSnapshot.length}`,
    `-- 字段数：${fieldCount}`,
    '',
  ].join('\n')
  const content = Buffer.from(sql, 'utf8')
  return {
    fileName: `replay-db-compare-config-${version.summary.versionNo}.sql`,
    content,
    sha256: createHash('sha256').update(content).digest('hex'),
    scriptSize: content.byteLength,
    generatedBy: 'c-mock-current',
    generatedName: '当前Mock用户',
    generatedAt: databaseComparisonLocalDateTime(),
  }
}

function databaseComparisonConfigScriptStatus(artifact) {
  if (!artifact) return { generated: false }
  return {
    generated: true,
    fileName: artifact.fileName,
    scriptSize: artifact.scriptSize,
    sha256: artifact.sha256,
    generatedBy: artifact.generatedBy,
    generatedName: artifact.generatedName,
    generatedAt: artifact.generatedAt,
  }
}

function downloadDatabaseComparisonConfigScript(res, artifact) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/sql; charset=UTF-8')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(artifact.fileName)}`)
  res.setHeader('X-Content-Sha256', artifact.sha256)
  return res.end(artifact.content)
}

function filterDatabaseComparisonSnapshot(snapshot, query = {}) {
  const contains = (value, keyword) => String(value || '').toLocaleLowerCase().includes(String(keyword || '').trim().toLocaleLowerCase())
  const selected = (values, value) => !Array.isArray(values) || !values.length || values.includes(value)
  return snapshot.filter(row => (
    (!query.tableKeyword || contains(`${row.tableName} ${row.tableComment}`, query.tableKeyword))
    && (!query.fieldKeyword || row.fields.some(field => contains(`${field.columnName} ${field.columnComment}`, query.fieldKeyword)))
    && selected(query.domains, row.domainName)
    && selected(query.reviserEmpNos, row.reviserEmpNo)
    && selected(query.groupOwnerEmpNos, row.groupOwnerEmpNo)
    && (!query.registeredDateFrom || row.registeredDate >= query.registeredDateFrom)
    && (!query.registeredDateTo || row.registeredDate <= query.registeredDateTo)
  ))
}

function databaseComparisonHeaderOptions(snapshot, query = {}) {
  const columns = {
    domainName: row => ({ value: row.domainName, label: row.domainName }),
    reviser: row => ({ value: row.reviserEmpNo, label: `${row.reviserName}(${row.reviserEmpNo})` }),
    groupOwner: row => ({ value: row.groupOwnerEmpNo, label: `${row.groupOwnerName}(${row.groupOwnerEmpNo})` }),
  }
  const readOption = columns[query.targetColumn]
  if (!readOption) return { options: [], matchedRegistrationCount: snapshot.length }
  const keyword = String(query.keyword || '').trim().toLocaleLowerCase()
  const counts = new Map()
  snapshot.forEach(row => {
    const option = readOption(row)
    if (keyword && !`${option.value} ${option.label}`.toLocaleLowerCase().includes(keyword)) return
    const existing = counts.get(option.value) || { ...option, count: 0 }
    existing.count += 1
    counts.set(option.value, existing)
  })
  const limit = Math.max(1, Number(query.limit || 200))
  return {
    options: [...counts.values()].sort((left, right) => left.label.localeCompare(right.label, 'zh-CN')).slice(0, limit),
    matchedRegistrationCount: snapshot.length,
  }
}

// ────────────── 回放配置管理 mock ──────────────

const REPLAY_CONFIG_TYPES = [
  'unconditional-ignores',
  'conditional-ignores',
  'error-code-ignores',
  'sort-fields',
]

// 内部核心交易码 → ESF 服务码（去点号后追加三种后缀），用于 internalTransactionCode 筛选
const REPLAY_CONFIG_ZNZX_SERVICE = [
  { tranCode: 'Y444', esfServiceCode: 'S120034071CorpInfo.QryTrdCrclr' },
  { tranCode: 'Y444', esfServiceCode: 'S120034071CorpInfoQry' },
  { tranCode: 'Z999', esfServiceCode: 'S120033800.LoanQuery' },
  { tranCode: 'Y555', esfServiceCode: 'S120090012.Account.Detail.Qry' },
  { tranCode: 'Z111', esfServiceCode: 'S120077001.Transfer.Apply' },
  { tranCode: 'X222', esfServiceCode: 'S120055900.Card.Info.Qry' },
]

// 人员清单 mock：key 为 old_transaction_code（等于 znzx_service.tran_code）；domain 即忽略清单的「领域」列
const REPLAY_CONFIG_PERSONS = [
  { oldTransactionCode: 'Y444', domain: '公共', developer: '张三', bankOwner: '李四', bankOwnerEmpNos: 'c-lisi' },
  { oldTransactionCode: 'Z999', domain: '贷款', developer: '王五', bankOwner: '赵六', bankOwnerEmpNos: 'c-zhaoliu' },
  { oldTransactionCode: 'Y555', domain: '存款', developer: '钱七', bankOwner: '孙八', bankOwnerEmpNos: 'c-sunb' },
  { oldTransactionCode: 'Z111', domain: '结算', developer: '周九', bankOwner: '吴十', bankOwnerEmpNos: 'c-wus' },
  { oldTransactionCode: 'X222', domain: '卡业务', developer: '郑一', bankOwner: '王二', bankOwnerEmpNos: 'c-wange' },
]

// mock 登录人身份（工号用于审核权限比对）
const REPLAY_CONFIG_MOCK_OPERATOR = { username: 'mock-user', realName: 'Mock 用户', empNo: 'c-lisi' }

const REPLAY_CONFIG_META = {
  'unconditional-ignores': {
    fields: [
      { key: 'tranCode', column: 'tran_code', label: '服务码', required: true, serviceCode: true },
      { key: 'fieldName', column: 'field_name', label: '忽略字段', required: true },
      { key: 'ignoreReason', column: 'ignore_reason', label: '忽略原因', required: true },
    ],
    fixed: { enableFlag: 1 },
    filters: ['tranCode', 'fieldName', 'reviewStatus'],
    order: ['tranCode', 'fieldName'],
    unique: ['tranCode', 'fieldName'],
  },
  'conditional-ignores': {
    fields: [
      { key: 'origTrcd', column: 'orig_trcd', label: '服务码', required: true, serviceCode: true },
      { key: 'fieldRmoveName', column: 'field_rmove_name', label: '忽略字段', required: true },
      { key: 'fieldFileFlag', column: 'field_file_flag', label: '字段标识', required: true },
      { key: 'origFieldCond', column: 'orig_field_cond', label: '主系统字段忽略条件' },
      { key: 'destFieldCond', column: 'dest_field_cond', label: '备系统字段忽略条件' },
      { key: 'ignoreReason', column: 'ignore_reason', label: '忽略原因', required: true },
    ],
    fixed: { fieldFielState: 1 },
    indexField: 'fieldFileIndx',
    indexColumn: 'field_file_indx',
    indexScope: 'origTrcd',
    filters: ['origTrcd', 'fieldRmoveName', 'fieldFileFlag', 'reviewStatus'],
    order: ['origTrcd', 'fieldFileIndx'],
    unique: ['origTrcd', 'fieldRmoveName', 'fieldFileIndx'],
  },
  'error-code-ignores': {
    fields: [
      { key: 'serviceCode', column: 'service_code', label: '服务码', required: true, serviceCode: true },
      { key: 'oldRespCode', column: 'old_resp_code', label: '老核心错误码' },
      { key: 'newRespCode', column: 'new_resp_code', label: '新核心错误码' },
      { key: 'ignoreReason', column: 'ignore_reason', label: '忽略原因', required: true },
    ],
    fixed: { enabled: 1 },
    filters: ['serviceCode', 'oldRespCode', 'newRespCode', 'reviewStatus'],
    order: ['serviceCode', 'oldRespCode', 'newRespCode'],
    unique: ['serviceCode', 'oldRespCode', 'newRespCode'],
  },
  'sort-fields': {
    fields: [
      { key: 'origTrcd', column: 'orig_trcd', label: '服务码', required: true, serviceCode: true },
      { key: 'origArryName', column: 'orig_arry_name', label: '对象/数组名称', required: true },
      { key: 'origFieldName', column: 'orig_field_name', label: '排序字段', required: true },
      { key: 'ignoreReason', column: 'ignore_reason', label: '忽略原因', required: true },
    ],
    fixed: { tranMode: 1 },
    filters: ['origTrcd', 'origArryName', 'origFieldName', 'reviewStatus'],
    order: ['origTrcd', 'origArryName', 'origFieldName'],
    unique: ['origTrcd', 'origArryName', 'origFieldName'],
  },
}

const REPLAY_SERVICE_CODE_PATTERN = /^[0-9A-Za-z]+&(sop|soap|bzjson)$/

function replayConfigTimestamp() {
  return new Date().toISOString().slice(0, 23)
}

function replayConfigNextId(store) {
  return store.nextId++
}

function replayConfigResolveServiceCodes(internalTransactionCode) {
  if (!internalTransactionCode) return null
  const codes = new Set()
  for (const mapping of REPLAY_CONFIG_ZNZX_SERVICE) {
    if (mapping.tranCode !== internalTransactionCode) continue
    const base = mapping.esfServiceCode.replace(/\./g, '')
    if (!base) continue
    codes.add(`${base}&sop`)
    codes.add(`${base}&soap`)
    codes.add(`${base}&bzjson`)
  }
  return [...codes]
}

function replayConfigChanges(type, before, after, onlyChanged) {
  const meta = REPLAY_CONFIG_META[type]
  const changes = []
  const push = (field, label, oldValue, newValue) => {
    changes.push({
      field,
      label,
      oldValue: oldValue === undefined ? null : oldValue,
      newValue: newValue === undefined ? null : newValue,
    })
  }
  for (const field of meta.fields) {
    const oldValue = before ? (before[field.key] ?? null) : null
    const newValue = after ? (after[field.key] ?? null) : null
    if (onlyChanged) {
      if (String(oldValue ?? '') === String(newValue ?? '')) continue
    } else if (oldValue === null && newValue === null) {
      continue
    }
    push(field.column || field.key, field.label, oldValue, newValue)
  }
  if (meta.indexField) {
    const oldIndex = before ? (before[meta.indexField] ?? null) : null
    const newIndex = after ? (after[meta.indexField] ?? null) : null
    if ((!onlyChanged && (oldIndex !== null || newIndex !== null)) || (onlyChanged && oldIndex !== newIndex)) {
      push(meta.indexColumn || meta.indexField, '字段索引', oldIndex, newIndex)
    }
  }
  const oldReview = before ? (before.reviewStatus ?? null) : null
  const newReview = after ? (after.reviewStatus ?? null) : null
  if ((!onlyChanged && (oldReview !== null || newReview !== null)) || (onlyChanged && oldReview !== newReview)) {
    push('review_status', '审核状态', oldReview, newReview)
  }
  return changes
}

/** 最终服务码 → 人员清单（去后缀 → znzx_service → old_transaction_code）。 */
function replayConfigPerson(code) {
  if (!code) return null
  const base = String(code).replace(/&(sop|soap|bzjson)$/, '')
  const mapping = REPLAY_CONFIG_ZNZX_SERVICE.find(item => item.esfServiceCode.replace(/\./g, '') === base)
  if (!mapping) return null
  return REPLAY_CONFIG_PERSONS.find(person => person.oldTransactionCode === mapping.tranCode) || null
}

function replayConfigIsOwner(type, row) {
  const serviceField = REPLAY_CONFIG_META[type].fields.find(field => field.serviceCode).key
  const person = replayConfigPerson(row[serviceField])
  if (!person) return false
  const owners = String(person.bankOwnerEmpNos || '').split(/[、,，;；]/).map(item => item.trim())
  return owners.includes(REPLAY_CONFIG_MOCK_OPERATOR.empNo)
}

function replayConfigEnrich(type, row) {
  const serviceField = REPLAY_CONFIG_META[type].fields.find(field => field.serviceCode).key
  const person = replayConfigPerson(row[serviceField])
  const status = Number(row.reviewStatus ?? 0)
  let reason = null
  if (!person) {
    reason = '无审核人'
  } else if (status === 1) {
    reason = '已审核'
  } else if (!replayConfigIsOwner(type, row)) {
    const names = String(person.bankOwner || '')
      .split(/[、,，;；]/)
      .map(item => item.replace(/[（(][^）)]*[）)]/g, '').trim())
      .filter(Boolean)
    reason = names.length ? `没有权限，请联系${names.join('、')}进行审核` : '没有审核权限'
  }
  return {
    ...row,
    oldTransactionCode: person ? person.oldTransactionCode : null,
    developer: person ? person.developer : null,
    bankOwner: person ? person.bankOwner : null,
    domain: person ? person.domain : null,
    canReview: reason === null,
    reviewDisabledReason: reason,
  }
}

/** 领域选项：全部领域，取自人员清单。 */
function replayConfigListDomains() {
  return [...new Set(REPLAY_CONFIG_PERSONS.map(person => person.domain).filter(Boolean))].sort()
}

function replayConfigOperation(store, type, configId, operationType, changes) {
  return {
    id: replayConfigNextId(store),
    configId,
    operationType,
    operatorUsername: 'mock-user',
    operatorRealName: 'Mock 用户',
    operationSource: 'MANUAL',
    createdAt: replayConfigTimestamp(),
    changes,
  }
}

function replayConfigValidateBody(type, body) {
  const meta = REPLAY_CONFIG_META[type]
  const value = {}
  for (const field of meta.fields) {
    let raw = body[field.key]
    if (typeof raw === 'string') raw = raw.trim()
    const empty = raw === undefined || raw === null || raw === ''
    if (field.required && empty) return { error: `${field.label}不能为空` }
    if (field.serviceCode && !empty && !REPLAY_SERVICE_CODE_PATTERN.test(raw)) {
      return { error: `${field.label}格式不正确，应为 <服务码>&sop|&soap|&bzjson` }
    }
    if (field.key === 'fieldFileFlag' && !empty && Number(raw) !== 1 && Number(raw) !== 2) {
      return { error: '字段标识只允许 1 或 2' }
    }
    if (field.key === 'fieldFileFlag') value[field.key] = empty ? null : Number(raw)
    else value[field.key] = empty ? null : raw
  }
  if (type === 'error-code-ignores' && !value.oldRespCode && !value.newRespCode) {
    return { error: '老核心错误码与新核心错误码不能同时为空' }
  }
  return { value }
}

function replayConfigIsDuplicate(type, candidate, list, excludeId) {
  const keys = REPLAY_CONFIG_META[type].unique
  if (keys.some(key => candidate[key] === null || candidate[key] === undefined)) return false
  return list.some(row => row.id !== excludeId && keys.every(key => (row[key] ?? null) === candidate[key]))
}

function replayConfigNextIndex(store, type, scopeValue) {
  const meta = REPLAY_CONFIG_META[type]
  const max = store.data[type]
    .filter(row => row[meta.indexScope] === scopeValue)
    .reduce((current, row) => Math.max(current, Number(row[meta.indexField]) || 0), 0)
  return max + 1
}

function replayConfigCompare(left, right) {
  if (left === right) return 0
  if (left === null || left === undefined) return -1
  if (right === null || right === undefined) return 1
  return String(left).localeCompare(String(right))
}

function replayConfigFilterRows(store, type, query) {
  const meta = REPLAY_CONFIG_META[type]
  let rows = [...store.data[type]]
  const codes = replayConfigResolveServiceCodes(query.internalTransactionCode)
  if (codes !== null) {
    const serviceField = meta.fields.find(field => field.serviceCode).key
    rows = rows.filter(row => codes.includes(row[serviceField]))
  }
  for (const key of meta.filters) {
    const raw = query[key]
    if (raw === undefined || raw === '') continue
    if (key === 'fieldFileFlag') rows = rows.filter(row => Number(row[key]) === Number(raw))
    else if (key === 'reviewStatus') rows = rows.filter(row => String(row.reviewStatus ?? 0) === String(raw))
    else rows = rows.filter(row => String(row[key] ?? '').includes(raw))
  }
  // 领域不是配置表字段：经「服务码 → 人员清单」映射后再筛
  const domain = query.domain
  if (domain !== undefined && domain !== '') {
    const serviceField = meta.fields.find(field => field.serviceCode).key
    rows = rows.filter(row => {
      const person = replayConfigPerson(row[serviceField])
      return person !== null && person.domain === domain
    })
  }
  if (query.reviewableByMe === 'true' || query.reviewableByMe === true) {
    rows = rows.filter(row => replayConfigIsOwner(type, row))
  }
  rows.sort((left, right) => {
    const compared = replayConfigCompare(right.updatedAt, left.updatedAt)
    if (compared !== 0) return compared
    return right.id - left.id
  })
  return rows
}

function replayConfigLimit(raw) {
  if (raw === undefined || raw === '') return 10
  const value = Number(raw)
  return [10, 30, 50, 100].includes(value) ? value : null
}

function parseReplaySortField(value) {
  const text = String(value ?? '').trim()
  const bracket = text.match(/^([^(]+)\(([^)]+)\)$/)
  if (bracket) {
    const arryName = bracket[1].trim()
    const fieldName = bracket[2].trim()
    if (arryName && fieldName) return { arryName, fieldName }
    return null
  }
  const dot = text.indexOf('.')
  if (dot > 0 && dot < text.length - 1) {
    const arryName = text.slice(0, dot).trim()
    const fieldName = text.slice(dot + 1).trim()
    if (arryName && fieldName) return { arryName, fieldName }
  }
  return null
}

function createReplaySortFields(store, res, body) {
  const tranCode = String(body.tranCode ?? '').trim()
  if (!tranCode) return replayConfigFail(res, 400, '交易码不能为空')
  const ignoreReason = String(body.ignoreReason ?? '').trim()
  if (!ignoreReason) return replayConfigFail(res, 400, '忽略原因不能为空')
  const oldParsed = parseReplaySortField(body.oldSortField)
  if (!oldParsed) return replayConfigFail(res, 400, '老核心排序字段格式不正确，应为 A.B 或 A(B,C)')
  const newParsed = parseReplaySortField(body.newSortField)
  if (!newParsed) return replayConfigFail(res, 400, '新核心排序字段格式不正确，应为 A.B 或 A(B,C)')

  const mappings = REPLAY_CONFIG_ZNZX_SERVICE.filter(item => item.tranCode === tranCode)
  if (!mappings.length) return replayConfigFail(res, 400, `交易码无映射：${tranCode}`)

  const drafts = []
  const seen = new Set()
  const add = (origTrcd, parsed) => {
    const key = `${origTrcd}|${parsed.arryName}|${parsed.fieldName}`
    if (!seen.has(key)) {
      seen.add(key)
      drafts.push({ origTrcd, arryName: parsed.arryName, fieldName: parsed.fieldName })
    }
  }
  for (const mapping of mappings) {
    const base = mapping.esfServiceCode.replace(/\./g, '')
    if (!base) continue
    add(`${base}&sop`, oldParsed)
    add(`${base}&soap`, newParsed)
    add(`${base}&bzjson`, newParsed)
  }
  if (!drafts.length) return replayConfigFail(res, 400, `交易码无映射：${tranCode}`)

  for (const draft of drafts) {
    if (replayConfigIsDuplicate('sort-fields', {
      origTrcd: draft.origTrcd, origArryName: draft.arryName, origFieldName: draft.fieldName,
    }, store.data['sort-fields'])) {
      return replayConfigFail(res, 409, '配置已存在')
    }
  }

  const created = []
  for (const draft of drafts) {
    const timestamp = replayConfigTimestamp()
    const row = {
      id: replayConfigNextId(store),
      ...REPLAY_CONFIG_META['sort-fields'].fixed,
      origTrcd: draft.origTrcd,
      origArryName: draft.arryName,
      origFieldName: draft.fieldName,
      ignoreReason,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 0,
    }
    store.data['sort-fields'].push(row)
    store.operations['sort-fields'].push(
      replayConfigOperation(store, 'sort-fields', row.id, 'CREATE',
        replayConfigChanges('sort-fields', null, row, false)),
    )
    created.push(row)
  }
  return ok(res, created.map(row => replayConfigEnrich('sort-fields', row)))
}

function replayConfigFail(res, status, message) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = status
  res.end(JSON.stringify({ code: status, message }))
}

function replayConfigSeedTime(index) {
  const base = Date.UTC(2026, 8, 16, 10, 0, 0)
  return new Date(base - index * 37 * 60000).toISOString().slice(0, 23)
}

function createReplayConfigStore() {
  const store = { nextId: 1000, data: {}, operations: {} }
  for (const type of REPLAY_CONFIG_TYPES) {
    store.data[type] = []
    store.operations[type] = []
  }
  const seed = (type, rows) => {
    rows.forEach((partial, index) => {
      const timestamp = replayConfigSeedTime(index)
      const id = replayConfigNextId(store)
      const row = {
        id,
        ...REPLAY_CONFIG_META[type].fixed,
        ...partial,
        ignoreReason: partial.ignoreReason ?? null,
        reviewStatus: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 0,
      }
      store.data[type].push(row)
      store.operations[type].push(
        replayConfigOperation(store, type, id, 'CREATE', replayConfigChanges(type, null, row, false)),
      )
    })
  }

  const corp = 'S120034071CorpInfoQryTrdCrclr'
  const loan = 'S120033800LoanQuery'
  const account = 'S120090012AccountDetailQry'
  const transfer = 'S120077001TransferApply'
  const card = 'S120055900CardInfoQry'

  seed('unconditional-ignores', [
    { tranCode: `${corp}&sop`, fieldName: 'accountNo' },
    { tranCode: `${corp}&soap`, fieldName: 'customerName' },
    { tranCode: `${corp}&bzjson`, fieldName: 'idCardNo' },
    { tranCode: `${loan}&sop`, fieldName: 'loanNo' },
    { tranCode: `${loan}&soap`, fieldName: 'repaymentDate' },
    { tranCode: `${loan}&bzjson`, fieldName: 'overdueFlag' },
    { tranCode: `${account}&sop`, fieldName: 'balance' },
    { tranCode: `${account}&soap`, fieldName: 'availableBalance' },
    { tranCode: `${account}&bzjson`, fieldName: 'branchCode' },
    { tranCode: `${transfer}&sop`, fieldName: 'payeeAccount' },
    { tranCode: `${transfer}&soap`, fieldName: 'payerAccount' },
    { tranCode: `${transfer}&bzjson`, fieldName: 'transferAmount' },
    { tranCode: `${card}&sop`, fieldName: 'cardNo' },
    { tranCode: `${card}&soap`, fieldName: 'mobileNo' },
  ])

  seed('conditional-ignores', [
    { origTrcd: `${corp}&sop`, fieldRmoveName: 'customerList', fieldFileIndx: 1, fieldFileFlag: 2, origFieldCond: "customerLevel >= '02'", destFieldCond: null },
    { origTrcd: `${corp}&soap`, fieldRmoveName: 'accounts', fieldFileIndx: 1, fieldFileFlag: 2, origFieldCond: "status == '0'", destFieldCond: null },
    { origTrcd: `${corp}&soap`, fieldRmoveName: 'accountType', fieldFileIndx: 2, fieldFileFlag: 1, origFieldCond: null, destFieldCond: "state == '1'" },
    { origTrcd: `${corp}&bzjson`, fieldRmoveName: 'idList', fieldFileIndx: 1, fieldFileFlag: 2, origFieldCond: null, destFieldCond: "certType == '01'" },
    { origTrcd: `${loan}&sop`, fieldRmoveName: 'loanItems', fieldFileIndx: 1, fieldFileFlag: 2, origFieldCond: "loanStatus == 'N'", destFieldCond: null },
    { origTrcd: `${loan}&soap`, fieldRmoveName: 'repayments', fieldFileIndx: 1, fieldFileFlag: 2, origFieldCond: null, destFieldCond: "repayStatus == '1'" },
    { origTrcd: `${account}&sop`, fieldRmoveName: 'details', fieldFileIndx: 1, fieldFileFlag: 2, origFieldCond: "txnAmount > '10000'", destFieldCond: null },
    { origTrcd: `${account}&soap`, fieldRmoveName: 'freezeList', fieldFileIndx: 1, fieldFileFlag: 2, origFieldCond: null, destFieldCond: "freezeFlag == '1'" },
    { origTrcd: `${transfer}&sop`, fieldRmoveName: 'feeDetail', fieldFileIndx: 1, fieldFileFlag: 1, origFieldCond: null, destFieldCond: "feeType == '02'" },
    { origTrcd: `${transfer}&bzjson`, fieldRmoveName: 'payeeList', fieldFileIndx: 1, fieldFileFlag: 2, origFieldCond: "payeeType == '01'", destFieldCond: null },
    { origTrcd: `${card}&sop`, fieldRmoveName: 'mobileNo', fieldFileIndx: 1, fieldFileFlag: 1, origFieldCond: null, destFieldCond: null },
    { origTrcd: `${card}&bzjson`, fieldRmoveName: 'cardList', fieldFileIndx: 1, fieldFileFlag: 2, origFieldCond: "cardStatus == '1'", destFieldCond: null },
  ])

  seed('error-code-ignores', [
    { serviceCode: `${corp}&sop`, oldRespCode: 'E100', newRespCode: 'N100' },
    { serviceCode: `${corp}&soap`, oldRespCode: 'E101', newRespCode: null },
    { serviceCode: `${corp}&bzjson`, oldRespCode: 'E001', newRespCode: 'N001' },
    { serviceCode: `${loan}&sop`, oldRespCode: null, newRespCode: 'N002' },
    { serviceCode: `${loan}&soap`, oldRespCode: 'E102', newRespCode: 'N102' },
    { serviceCode: `${account}&sop`, oldRespCode: 'E200', newRespCode: 'N200' },
    { serviceCode: `${account}&soap`, oldRespCode: null, newRespCode: 'N201' },
    { serviceCode: `${transfer}&bzjson`, oldRespCode: 'E300', newRespCode: 'N300' },
    { serviceCode: `${transfer}&sop`, oldRespCode: 'E301', newRespCode: 'N301' },
    { serviceCode: `${card}&soap`, oldRespCode: 'E400', newRespCode: null },
    { serviceCode: `${card}&bzjson`, oldRespCode: null, newRespCode: 'N401' },
  ])

  seed('sort-fields', [
    { origTrcd: `${corp}&sop`, origArryName: 'accounts', origFieldName: 'accountNo' },
    { origTrcd: `${corp}&soap`, origArryName: 'accounts', origFieldName: 'accountNo' },
    { origTrcd: `${corp}&bzjson`, origArryName: 'accounts', origFieldName: 'accountNo' },
    { origTrcd: `${loan}&sop`, origArryName: 'loanItems', origFieldName: 'loanNo' },
    { origTrcd: `${loan}&soap`, origArryName: 'loanItems', origFieldName: 'loanNo,loanType' },
    { origTrcd: `${loan}&bzjson`, origArryName: 'loanItems', origFieldName: 'loanNo,loanType' },
    { origTrcd: `${account}&sop`, origArryName: 'details', origFieldName: 'txnDate' },
    { origTrcd: `${account}&soap`, origArryName: 'details', origFieldName: 'txnDate,txnTime' },
    { origTrcd: `${account}&bzjson`, origArryName: 'details', origFieldName: 'txnDate,txnTime' },
    { origTrcd: `${transfer}&sop`, origArryName: 'feeDetail', origFieldName: 'feeNo' },
    { origTrcd: `${transfer}&soap`, origArryName: 'feeDetail', origFieldName: 'feeNo' },
    { origTrcd: `${transfer}&bzjson`, origArryName: 'feeDetail', origFieldName: 'feeNo' },
  ])

  return store
}

function handleReplayConfig(req, res, query, path, store) {
  const segments = path.split('/')
  const type = segments[5]
  const idPart = segments[6]
  const sub = segments[7]
  if (type === 'domains') {
    return ok(res, replayConfigListDomains())
  }
  const meta = REPLAY_CONFIG_META[type]
  if (!meta) return replayConfigFail(res, 404, '资源类型不存在')

  if (req.method === 'POST' && idPart === 'batch-create') {
    return readJsonBody(req).then(body => {
      const items = Array.isArray(body.items) ? body.items : []
      if (!items.length || items.length > 3) return replayConfigFail(res, 400, '单次最多新增 3 条')
      const candidates = []
      const indexCounter = new Map()
      for (const item of items) {
        const validated = replayConfigValidateBody(type, item)
        if (validated.error) return replayConfigFail(res, 400, validated.error)
        const candidate = { ...meta.fixed, ...validated.value }
        if (meta.indexField) {
          const scope = candidate[meta.indexScope]
          const next = indexCounter.has(scope)
            ? indexCounter.get(scope)
            : replayConfigNextIndex(store, type, scope)
          candidate[meta.indexField] = next
          indexCounter.set(scope, next + 1)
        }
        if (replayConfigIsDuplicate(type, candidate, store.data[type])) {
          return replayConfigFail(res, 409, '配置已存在，整批未写入')
        }
        candidates.push(candidate)
      }
      const rows = candidates.map(candidate => {
        const timestamp = replayConfigTimestamp()
        const row = {
          id: replayConfigNextId(store), ...candidate, reviewStatus: 0,
          createdAt: timestamp, updatedAt: timestamp, version: 0,
        }
        store.data[type].push(row)
        store.operations[type].push(
          replayConfigOperation(store, type, row.id, 'CREATE', replayConfigChanges(type, null, row, false)),
        )
        return row
      })
      return ok(res, rows.map(row => replayConfigEnrich(type, row)))
    })
  }

  if (req.method === 'POST' && idPart === 'batch-review') {
    return readJsonBody(req).then(body => {
      const items = Array.isArray(body.items) ? body.items : []
      if (!items.length || items.length > 100) return replayConfigFail(res, 400, '批量审核数量不合法')
      const seen = new Set()
      for (const item of items) {
        if (!item || !item.id || seen.has(item.id)) return replayConfigFail(res, 400, '批量审核记录不合法')
        seen.add(item.id)
      }
      let approved = 0
      for (const item of items) {
        const row = store.data[type].find(candidate => candidate.id === item.id)
        if (!row || row.version !== item.version || row.reviewStatus === 1 || !replayConfigIsOwner(type, row)) continue
        row.reviewStatus = 1
        row.version += 1
        row.updatedAt = replayConfigTimestamp()
        store.operations[type].push(replayConfigOperation(store, type, row.id, 'REVIEW', [
          { field: 'review_status', label: '审核状态', oldValue: '0', newValue: '1' },
        ]))
        approved++
      }
      return ok(res, { approvedCount: approved, skippedCount: items.length - approved })
    })
  }

  if (req.method === 'POST' && idPart && sub === 'review') {
    return readJsonBody(req).then(body => {
      const id = Number(idPart)
      const row = store.data[type].find(candidate => candidate.id === id)
      if (!row) return replayConfigFail(res, 404, '记录不存在')
      if (row.version !== body.version) return replayConfigFail(res, 409, '数据已被其他用户修改，请刷新后重试')
      if (row.reviewStatus === 1) {
        return ok(res, replayConfigEnrich(type, row))
      }
      if (!replayConfigIsOwner(type, row)) {
        const hint = replayConfigEnrich(type, row)
        return replayConfigFail(res, 403, hint.reviewDisabledReason)
      }
      row.reviewStatus = 1
      row.version += 1
      row.updatedAt = replayConfigTimestamp()
      store.operations[type].push(replayConfigOperation(store, type, id, 'REVIEW', [
        { field: 'review_status', label: '审核状态', oldValue: '0', newValue: '1' },
      ]))
      return ok(res, replayConfigEnrich(type, row))
    })
  }

  if (req.method === 'POST' && idPart === 'batch-delete') {
    return readJsonBody(req).then(body => {
      const items = Array.isArray(body.items) ? body.items : []
      if (!items.length || items.length > 100) return replayConfigFail(res, 400, '批量删除数量不合法')
      const seen = new Set()
      for (const item of items) {
        if (!item || !item.id || seen.has(item.id)) return replayConfigFail(res, 400, '批量删除记录不合法')
        seen.add(item.id)
        const row = store.data[type].find(candidate => candidate.id === item.id)
        if (!row) return replayConfigFail(res, 404, `记录不存在：${item.id}`)
        if (row.version !== item.version) return replayConfigFail(res, 409, '数据已被其他用户修改，请刷新后重试')
      }
      for (const item of items) {
        const row = store.data[type].find(candidate => candidate.id === item.id)
        store.operations[type].push(
          replayConfigOperation(store, type, row.id, 'DELETE', replayConfigChanges(type, row, null, false)),
        )
        store.data[type] = store.data[type].filter(candidate => candidate.id !== row.id)
      }
      return ok(res, { deletedCount: items.length })
    })
  }

  if (req.method === 'GET' && idPart && sub === 'operations') {
    const configId = Number(idPart)
    if (!store.data[type].some(row => row.id === configId)) return replayConfigFail(res, 404, '记录不存在')
    const limit = replayConfigLimit(query.limit)
    if (limit === null) return replayConfigFail(res, 400, '分页大小只允许 10、30、50、100')
    const offset = Number(query.offset || 0)
    if (offset < 0) return replayConfigFail(res, 400, '偏移量不能小于 0')
    const operations = store.operations[type]
      .filter(operation => operation.configId === configId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id - left.id)
    return ok(res, { total: operations.length, items: operations.slice(offset, offset + limit) })
  }

  if (req.method === 'POST' && !idPart) {
    return readJsonBody(req).then(body => {
      if (type === 'sort-fields') {
        return createReplaySortFields(store, res, body)
      }
      const validated = replayConfigValidateBody(type, body)
      if (validated.error) return replayConfigFail(res, 400, validated.error)
      const candidate = { ...meta.fixed, ...validated.value }
      if (meta.indexField) candidate[meta.indexField] = replayConfigNextIndex(store, type, candidate[meta.indexScope])
      if (replayConfigIsDuplicate(type, candidate, store.data[type])) {
        return replayConfigFail(res, 409, '配置已存在')
      }
      const timestamp = replayConfigTimestamp()
      const row = {
        id: replayConfigNextId(store), ...candidate, reviewStatus: 0,
        createdAt: timestamp, updatedAt: timestamp, version: 0,
      }
      store.data[type].push(row)
      store.operations[type].push(
        replayConfigOperation(store, type, row.id, 'CREATE', replayConfigChanges(type, null, row, false)),
      )
      return ok(res, replayConfigEnrich(type, row))
    })
  }

  if (req.method === 'PATCH' && idPart && !sub) {
    return readJsonBody(req).then(body => {
      const id = Number(idPart)
      const row = store.data[type].find(candidate => candidate.id === id)
      if (!row) return replayConfigFail(res, 404, '记录不存在')
      const validated = replayConfigValidateBody(type, body)
      if (validated.error) return replayConfigFail(res, 400, validated.error)
      if (row.version !== body.version) return replayConfigFail(res, 409, '数据已被其他用户修改，请刷新后重试')
      const next = { ...row, ...validated.value, reviewStatus: 0 }
      if (meta.indexField && next[meta.indexScope] !== row[meta.indexScope]) {
        next[meta.indexField] = replayConfigNextIndex(store, type, next[meta.indexScope])
      }
      const changes = replayConfigChanges(type, row, next, true)
      if (!changes.length) return ok(res, replayConfigEnrich(type, row))
      if (replayConfigIsDuplicate(type, next, store.data[type], id)) return replayConfigFail(res, 409, '配置已存在')
      next.version = row.version + 1
      next.updatedAt = replayConfigTimestamp()
      Object.assign(row, next)
      store.operations[type].push(replayConfigOperation(store, type, id, 'UPDATE', changes))
      return ok(res, replayConfigEnrich(type, row))
    })
  }

  if (req.method === 'DELETE' && idPart && !sub) {
    const id = Number(idPart)
    const row = store.data[type].find(candidate => candidate.id === id)
    if (!row) return replayConfigFail(res, 404, '记录不存在')
    const version = query.version === undefined || query.version === '' ? null : Number(query.version)
    if (version === null || Number.isNaN(version)) return replayConfigFail(res, 400, '缺少 version')
    if (row.version !== version) return replayConfigFail(res, 409, '数据已被其他用户修改，请刷新后重试')
    store.operations[type].push(
      replayConfigOperation(store, type, id, 'DELETE', replayConfigChanges(type, row, null, false)),
    )
    store.data[type] = store.data[type].filter(candidate => candidate.id !== id)
    return ok(res, null)
  }

  if (req.method === 'GET' && !idPart) {
    const limit = replayConfigLimit(query.limit)
    if (limit === null) return replayConfigFail(res, 400, '分页大小只允许 10、30、50、100')
    const offset = Number(query.offset || 0)
    if (offset < 0) return replayConfigFail(res, 400, '偏移量不能小于 0')
    const rows = replayConfigFilterRows(store, type, query)
    return ok(res, { total: rows.length, items: rows.slice(offset, offset + limit).map(row => replayConfigEnrich(type, row)) })
  }

  return replayConfigFail(res, 404, '接口不存在')
}

// ────────────── Vite 插件 ──────────────

export function daoIndexMockPlugin() {
  const initialSnapshots = [
    ['20260914-160001', '当前Mock用户', '2026-09-14T16:00:01', buildDatabaseComparisonSnapshot(80, 0)],
    ['20260913-143020', '张三', '2026-09-13T14:30:20', buildDatabaseComparisonSnapshot(60, 1)],
    ['20260912-091530', '系统', '2026-09-12T09:15:30', buildDatabaseComparisonSnapshot(40, 2)],
  ]
  const databaseComparisonVersions = initialSnapshots.map(([versionNo, generatedName, generatedAt, snapshot], index) => ({
    summary: databaseComparisonVersionSummary(versionNo, generatedName, generatedAt, snapshot, index === 0),
    snapshot,
  }))
  const databaseComparisonConfigScripts = new Map()
  const preGeneratedVersion = databaseComparisonVersions.find(item => item.summary.versionNo === '20260913-143020')
  databaseComparisonConfigScripts.set(
    preGeneratedVersion.summary.versionNo,
    buildDatabaseComparisonConfigScript(preGeneratedVersion),
  )
  const generatedDailyReports = new Map([
    ['RPT20260818-01', '2026-08-18T11:00:00'],
    ['RPT20260825-01', '2026-08-25T11:00:00'],
    ['RPT20260901-01', '2026-09-01T11:00:00'],
    ['RPT20260902-01', '2026-09-02T11:00:00'],
    ['DZ20260820-01', '2026-08-20T12:00:00'],
    ['DZ20260902-01', '2026-09-02T12:00:00'],
  ])
  const dailyReportMailStatuses = new Map()
  const generatedWeeklyReports = new Map([
    ['RPT20260825-01|RPT20260903-01', '2026-09-03T12:00:00'],
    ['DZ20260820-01|DZ20260902-01', '2026-09-02T14:00:00'],
    ['RPT20260818-01|RPT20260902-01', '2026-09-02T13:00:00'],
    ['RPT20260818-01|RPT20260901-01', '2026-09-01T12:00:00'],
    ['RPT20260818-01|RPT20260825-01', '2026-08-25T12:00:00'],
  ])
  const weeklyReportMailStatuses = new Map([
    ['RPT20260825-01|RPT20260903-01', { status: 'SENT', sentAt: '2026-09-03T12:20:00', failureMessage: null }],
    ['RPT20260818-01|RPT20260901-01', { status: 'FAILED', sentAt: null, failureMessage: 'Mock：邮件服务器暂不可用' }],
  ])
  const replayConfigStore = createReplayConfigStore()
  return {
    name: 'dao-index-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        const path = url.split('?')[0]
        if (url.startsWith(DB_COMPARE_VERSION_PREFIX)) {
          const versionPath = path.slice(DB_COMPARE_VERSION_PREFIX.length)
          if (req.method === 'GET' && versionPath === '/latest') {
            return ok(res, databaseComparisonVersions[0]?.summary || null)
          }
          if (req.method === 'GET' && versionPath === '') {
            const query = parseQuery(url)
            const page = Math.max(0, Number(query.page || 0))
            const size = Math.max(1, Number(query.size || 20))
            return ok(res, {
              items: databaseComparisonVersions.slice(page * size, (page + 1) * size).map(item => item.summary),
              page,
              size,
              total: databaseComparisonVersions.length,
            })
          }
          if (req.method === 'POST' && versionPath === '/generate') {
            if (req.headers['x-dii-trigger-token'] !== 'secret') {
              res.statusCode = 401
              return res.end(JSON.stringify({
                code: 401,
                message: '口令错误',
                data: { errorCode: 'INVALID_TRIGGER_TOKEN' },
              }))
            }
            const snapshot = buildDatabaseComparisonSnapshot(80, 0)
            const generatedAt = new Date()
            let versionNo = databaseComparisonVersionNo(generatedAt)
            if (databaseComparisonVersions.some(item => item.summary.versionNo === versionNo)) {
              generatedAt.setSeconds(generatedAt.getSeconds() + 1)
              versionNo = databaseComparisonVersionNo(generatedAt)
            }
            databaseComparisonVersions.forEach(item => { item.summary.latest = false })
            const summary = databaseComparisonVersionSummary(
              versionNo,
              '当前Mock用户',
              databaseComparisonLocalDateTime(generatedAt),
              snapshot,
              true,
            )
            databaseComparisonVersions.unshift({ summary, snapshot })
            return ok(res, summary)
          }
          const configScriptRoute = versionPath.match(/^\/([^/]+)\/config-script(?:\/(download))?$/)
          if (configScriptRoute) {
            const versionNo = decodeURIComponent(configScriptRoute[1])
            const version = databaseComparisonVersions.find(item => item.summary.versionNo === versionNo)
            if (!version) {
              res.statusCode = 404
              return res.end(JSON.stringify({ code: 404, message: '版本不存在' }))
            }
            const artifact = databaseComparisonConfigScripts.get(versionNo)
            if (req.method === 'GET' && !configScriptRoute[2]) {
              return ok(res, databaseComparisonConfigScriptStatus(artifact))
            }
            if (req.method === 'GET' && configScriptRoute[2] === 'download') {
              if (!artifact) {
                res.statusCode = 404
                return res.end(JSON.stringify({
                  code: 404,
                  message: '配置脚本尚未生成',
                  data: { errorCode: 'CONFIG_SCRIPT_NOT_GENERATED' },
                }))
              }
              return downloadDatabaseComparisonConfigScript(res, artifact)
            }
            if (req.method === 'POST' && !configScriptRoute[2]) {
              const storedArtifact = artifact || buildDatabaseComparisonConfigScript(version)
              if (!artifact) databaseComparisonConfigScripts.set(versionNo, storedArtifact)
              return downloadDatabaseComparisonConfigScript(res, storedArtifact)
            }
          }
          const route = versionPath.match(/^\/([^/]+)\/(search|header-filter-options)$/)
          if (req.method === 'POST' && route) {
            const versionNo = decodeURIComponent(route[1])
            const version = databaseComparisonVersions.find(item => item.summary.versionNo === versionNo)
            if (!version) {
              res.statusCode = 404
              return res.end(JSON.stringify({ code: 404, message: '版本不存在' }))
            }
            return readJsonBody(req).then((query) => {
              if (route[2] === 'header-filter-options') {
                return ok(res, databaseComparisonHeaderOptions(version.snapshot, query))
              }
              const rows = filterDatabaseComparisonSnapshot(version.snapshot, query)
              const page = Math.max(0, Number(query.page || 0))
              const size = Math.max(1, Number(query.size || 50))
              return ok(res, {
                items: rows.slice(page * size, (page + 1) * size),
                page,
                size,
                total: rows.length,
              })
            })
          }
        }
        if (url.startsWith('/api/ai/parallel-replay/issues')) {
          if (req.method === 'POST' && (path === '/api/ai/parallel-replay/issues'
              || path.endsWith('/header-filter-option-counts'))) {
            return readJsonBody(req).then((body) => {
              const q = {
                ...(body.query || {}),
                affectedTransactionCountOrder: body.affectedTransactionCountOrder,
              }
              if (q.replayType && !['ALL', 'DZ', 'QUERY'].includes(q.replayType)) {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '回放交易类型不合法' }))
              }
              if (path.endsWith('/header-filter-option-counts')) {
                return ok(res, replayHeaderFilterOptionCounts({ ...q, field: body.field, keyword: body.keyword }))
              }
              const rows = replaySortRows(replayFilterRows(q), q)
              const offset = Number(q.offset || 0); const limit = Number(q.limit || 50)
              return ok(res, { total: rows.length, items: rows.slice(offset, offset + limit).map(row => ({ ...row, weekly_task: isReplayWeeklyTask(row) })) })
            })
          }
          const q = parseQuery(url)
          if (q.replayType && !['ALL', 'DZ', 'QUERY'].includes(q.replayType)) {
            res.statusCode = 400
            return res.end(JSON.stringify({ code: 400, message: '回放交易类型不合法' }))
          }
          if (req.method === 'GET' && path.endsWith('/daily-report/batches')) {
            return ok(res, REPLAY_DAILY_REPORT_BATCHES.map(entry => ({
              ...entry,
              generated: generatedDailyReports.has(entry.batchNo),
              generatedAt: generatedDailyReports.get(entry.batchNo) || null,
              mailStatus: dailyReportMailStatuses.get(entry.batchNo)?.status || 'UNSENT',
              mailSentAt: dailyReportMailStatuses.get(entry.batchNo)?.sentAt || null,
              mailFailureMessage: dailyReportMailStatuses.get(entry.batchNo)?.failureMessage || null,
            })))
          }
          if (req.method === 'GET' && path.endsWith('/weekly-report/options')) {
            const dailyBatches = REPLAY_DAILY_REPORT_BATCHES
              .filter(entry => generatedDailyReports.has(entry.batchNo))
              .sort((left, right) => left.family.localeCompare(right.family)
                || left.importedAt.localeCompare(right.importedAt)
                || left.batchNo.localeCompare(right.batchNo))
              .map(entry => ({ ...entry, generated: true, generatedAt: generatedDailyReports.get(entry.batchNo) }))
            const weeklyReports = [...generatedWeeklyReports.entries()].map(([pair, generatedAt]) => {
              const [startBatchNo, endBatchNo] = pair.split('|')
              const mail = weeklyReportMailStatuses.get(pair) || {}
              return {
                startBatchNo, endBatchNo, family: endBatchNo.startsWith('DZ') ? 'DZ' : 'RPT', generatedAt,
                mailStatus: mail.status || 'UNSENT', mailSentAt: mail.sentAt || null,
                mailFailureMessage: mail.failureMessage || null,
              }
            })
            return ok(res, { dailyBatches, weeklyReports })
          }
          if (req.method === 'GET' && path.endsWith('/weekly-report/mail-config')) {
            const pair = `${q.startBatchNo}|${q.endBatchNo}`
            if (!generatedWeeklyReports.has(pair)) {
              res.statusCode = 404
              return res.end(JSON.stringify({ code: 404, message: '周报尚未生成' }))
            }
            const status = weeklyReportMailStatuses.get(pair) || { status: 'UNSENT', sentAt: null, failureMessage: null }
            const reportDate = q.endBatchNo.match(/^(?:RPT|DZ)(\d{8})/)?.[1] || ''
            return ok(res, {
              startBatchNo: q.startBatchNo,
              endBatchNo: q.endBatchNo,
              subject: `对公分布式核心回放问题周报-${reportDate}`,
              toEmails: ['replay-owner@example.com'],
              ccEmails: ['replay-leader@example.com'],
              body: '各位好，附件为本周期回放问题周报，请查收。',
              ...status,
            })
          }
          if (req.method === 'POST' && path.endsWith('/weekly-report/mail-send')) {
            if (req.headers['x-dii-trigger-token'] !== 'secret') {
              res.statusCode = 401
              return res.end(JSON.stringify({ code: 401, message: '口令错误' }))
            }
            return readJsonBody(req).then((body) => {
              const pair = `${body.startBatchNo}|${body.endBatchNo}`
              if (!generatedWeeklyReports.has(pair)) {
                res.statusCode = 404
                return res.end(JSON.stringify({ code: 404, message: '周报尚未生成' }))
              }
              if (!String(body.subject || '').trim() || !Array.isArray(body.toEmails)
                  || !body.toEmails.length || !String(body.body || '').trim()) {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '周报邮件内容不完整' }))
              }
              const status = { status: 'SENT', sentAt: new Date().toISOString().slice(0, 19), failureMessage: null }
              weeklyReportMailStatuses.set(pair, status)
              return ok(res, {
                startBatchNo: body.startBatchNo, endBatchNo: body.endBatchNo,
                subject: String(body.subject).trim(), toEmails: body.toEmails,
                ccEmails: Array.isArray(body.ccEmails) ? body.ccEmails : [], body: String(body.body), ...status,
              })
            })
          }
          if (req.method === 'GET' && path.endsWith('/weekly-report')) {
            const candidates = REPLAY_DAILY_REPORT_BATCHES
              .filter(entry => generatedDailyReports.has(entry.batchNo))
              .sort((left, right) => left.family.localeCompare(right.family)
                || left.importedAt.localeCompare(right.importedAt)
                || left.batchNo.localeCompare(right.batchNo))
            const startIndex = candidates.findIndex(entry => entry.batchNo === q.startBatchNo)
            const endIndex = candidates.findIndex(entry => entry.batchNo === q.endBatchNo)
            if (startIndex < 0 || endIndex < 0) {
              res.statusCode = 409
              return res.end(JSON.stringify({ code: 409, message: '所选批次日报尚未生成' }))
            }
            if (startIndex >= endIndex || candidates[startIndex].family !== candidates[endIndex].family) {
              res.statusCode = 400
              return res.end(JSON.stringify({ code: 400, message: '周报起止批次范围错误' }))
            }
            const pair = `${q.startBatchNo}|${q.endBatchNo}`
            if (!generatedWeeklyReports.has(pair)) {
              const occupied = [...generatedWeeklyReports.keys()]
                .some(existingPair => existingPair.split('|')[1] === q.endBatchNo)
              if (occupied) {
                res.statusCode = 409
                return res.end(JSON.stringify({ code: 409, message: '结束批次周报已生成' }))
              }
              generatedWeeklyReports.set(pair, new Date().toISOString().slice(0, 19))
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${q.endBatchNo}周报.xlsx`)}`)
            return res.end(Buffer.from('PK\u0003\u0004mock-weekly-xlsx'))
          }
          if (req.method === 'GET' && path.endsWith('/daily-report/mail-config')) {
            const batch = REPLAY_DAILY_REPORT_BATCHES.find(entry => entry.batchNo === q.batchNo)
            if (!batch || !generatedDailyReports.has(q.batchNo)) {
              res.statusCode = 404
              return res.end(JSON.stringify({ code: 404, message: '日报尚未生成' }))
            }
            const status = dailyReportMailStatuses.get(q.batchNo) || { status: 'UNSENT', sentAt: null, failureMessage: null }
            const reportDate = q.batchNo.match(/^(?:RPT|DZ)(\d{8})/)?.[1] || ''
            return ok(res, {
              batchNo: q.batchNo,
              subject: `对公分布式核心回放问题日报-${reportDate}`,
              toEmails: ['replay-owner@example.com'],
              ccEmails: ['replay-leader@example.com'],
              body: '各位好，附件为本批次回放问题日报，请查收。',
              ...status,
            })
          }
          if (req.method === 'POST' && path.endsWith('/daily-report/mail-send')) {
            if (req.headers['x-dii-trigger-token'] !== 'secret') {
              res.statusCode = 401
              return res.end(JSON.stringify({ code: 401, message: '口令错误' }))
            }
            return readJsonBody(req).then((body) => {
              if (!String(body.subject || '').trim()) {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '邮件标题不能为空' }))
              }
              if (!Array.isArray(body.toEmails) || !body.toEmails.length) {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '邮件收件人不能为空' }))
              }
              if (!String(body.body || '').trim()) {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '邮件正文不能为空' }))
              }
              if (!generatedDailyReports.has(body.batchNo)) {
                res.statusCode = 404
                return res.end(JSON.stringify({ code: 404, message: '日报尚未生成' }))
              }
              const status = { status: 'SENT', sentAt: new Date().toISOString().slice(0, 19), failureMessage: null }
              dailyReportMailStatuses.set(body.batchNo, status)
              const reportDate = body.batchNo.match(/^(?:RPT|DZ)(\d{8})/)?.[1] || ''
              return ok(res, {
                batchNo: body.batchNo,
                subject: String(body.subject).trim(),
                toEmails: body.toEmails,
                ccEmails: Array.isArray(body.ccEmails) ? body.ccEmails : [],
                body: String(body.body),
                ...status,
              })
            })
          }
          if (req.method === 'GET' && path.endsWith('/daily-report')) {
            const batch = REPLAY_DAILY_REPORT_BATCHES.find(entry => entry.batchNo === q.batchNo)
            if (!/^(RPT|DZ).+/.test(q.batchNo || '')) {
              res.statusCode = 400
              return res.end(JSON.stringify({ code: 400, message: '批次号格式错误' }))
            }
            if (!batch) {
              res.statusCode = 404
              return res.end(JSON.stringify({ code: 404, message: '批次数据不存在' }))
            }
            if (!batch.canGenerate) {
              res.statusCode = 409
              return res.end(JSON.stringify({ code: 409, message: '没有上批次数据' }))
            }
            if (!generatedDailyReports.has(batch.batchNo)) {
              generatedDailyReports.set(batch.batchNo, new Date().toISOString().slice(0, 19))
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${batch.batchNo}日报.xlsx`)}`)
            return res.end(Buffer.from('PK\u0003\u0004mock-xlsx'))
          }
          if (req.method === 'POST' && (path.endsWith('/import') || path.endsWith('/full-refresh'))) {
            return ok(res, { totalRows: 8, inputRows: 8, createdRows: 0, updatedRows: 8, ignoredRows: 0 })
          }
          if (url.endsWith('/weekly-task')) {
            if (req.method === 'PUT') {
              if (req.headers['x-dii-trigger-token'] !== 'secret') {
                res.statusCode = 401
                return res.end(JSON.stringify({ code: 401, message: '口令错误' }))
              }
              return readJsonBody(req).then((body) => {
                const requested = [...new Set((body.batchNames || []).map(value => String(value).trim()).filter(Boolean))].sort()
                const unknown = requested.filter(batch => !REPLAY_AVAILABLE_BATCHES.includes(batch))
                if (unknown.length) {
                  res.statusCode = 400
                  return res.end(JSON.stringify({ code: 400, message: `出现批次不存在：${unknown.join('、')}` }))
                }
                REPLAY_WEEKLY_TASK_BATCHES = requested
                return ok(res, replayWeeklyTaskConfig())
              })
            }
            return ok(res, replayWeeklyTaskConfig())
          }
          if (url.includes('/users')) {
            return ok(res, [
              { displayName: '张三', username: 'c-wangsh8', email: 'c-wangsh8@spdbdev.com' },
              { displayName: '孙海英', username: 'sunhy1', email: 'sunhy1@example.com' },
              { displayName: '李四', username: 'lisi', email: 'lisi@example.com' },
            ])
          }
          if (url.endsWith('/plan-date-permissions')) {
            return ok(res, { editableGroups: ['公共组'], editableTransactionCodes: ['E811'] })
          }
          if (url.endsWith('/issue-domain-permissions')) {
            return ok(res, { editableDomains: REPLAY_ISSUE_DOMAINS })
          }
          if (url.endsWith('/review-permissions')) {
            return ok(res, { reviewableGroups: [], reviewersByGroup: {}, reviewableTransactionCodes: [] })
          }
          if (req.method === 'GET' && url.includes('/issue-domain-transfers')) {
            const issueId = Number(url.match(/issues\/(\d+)/)?.[1] || 0)
            const issue = REPLAY_ISSUES.find(item => item.id === issueId)
            if (!issue) {
              res.statusCode = 404
              return res.end(JSON.stringify({ code: 404, message: '回放问题不存在' }))
            }
            const items = REPLAY_ISSUE_DOMAIN_TRANSFERS.get(issueId) || []
            return ok(res, { transferCount: items.length, items })
          }
          if (req.method === 'GET' && url.includes('/planned-completion-date-changes')) {
            const issueId = Number(url.match(/issues\/(\d+)/)?.[1] || 0)
            const issue = REPLAY_ISSUES.find(item => item.id === issueId)
            if (!issue) {
              res.statusCode = 404
              return res.end(JSON.stringify({ code: 404, message: '回放问题不存在' }))
            }
            const items = REPLAY_PLAN_DATE_CHANGES.get(issueId) || []
            return ok(res, { changeCount: items.length, items })
          }
          if (req.method === 'PATCH' && /\/issues\/\d+\/issue-domain(?:\?|$)/.test(url)) {
            const issueId = Number(url.match(/issues\/(\d+)/)?.[1] || 0)
            return readJsonBody(req).then((body) => {
              const issue = REPLAY_ISSUES.find(item => item.id === issueId)
              if (!issue) {
                res.statusCode = 404
                return res.end(JSON.stringify({ code: 404, message: '回放问题不存在' }))
              }
              const target = String(body.issueDomain || '').trim()
              if (!REPLAY_ISSUE_DOMAINS.includes(target)) {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '问题所属领域不合法' }))
              }
              if (issue.defect_repair_date) {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '问题已有缺陷修复日期，不可转组' }))
              }
              const items = REPLAY_ISSUE_DOMAIN_TRANSFERS.get(issueId) || []
              if (target === issue.issue_domain) return ok(res, { id: issueId, issueDomain: target, transferCount: items.length })
              if (items.length >= 3) {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '已经达到 3 次转组上限，无法继续转组' }))
              }
              items.unshift({
                fromDomain: issue.issue_domain,
                toDomain: target,
                operatorUsername: 'c-mock-current',
                operatorRealName: '当前Mock用户',
                transferredAt: '2026-08-31 12:00:00',
              })
              issue.issue_domain = target
              issue.issue_domain_transfer_count = items.length
              REPLAY_ISSUE_DOMAIN_TRANSFERS.set(issueId, items)
              return ok(res, { id: issueId, issueDomain: target, transferCount: items.length })
            })
          }
          if (req.method === 'GET' && url.includes('/round-tracking')) {
            const issueId = Number(url.match(/issues\/(\d+)/)?.[1] || 0)
            return ok(res, replayIssueRoundTracking(issueId))
          }
          if (req.method === 'PATCH' && url.includes('/planned-completion-date')) {
            const issueId = Number(url.match(/issues\/(\d+)/)?.[1] || 0)
            return readJsonBody(req).then((body) => {
              const issue = REPLAY_ISSUES.find(item => item.id === issueId)
              if (!issue) {
                res.statusCode = 404
                return res.end(JSON.stringify({ code: 404, message: '回放问题不存在' }))
              }
              const value = String(body.plannedCompletionDate || '').trim()
              if (issue.defect_repair_date) {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '问题已有缺陷修复日期，计划验证日期不可修改' }))
              }
              if (issue.group_name !== '公共组' && issue.transaction_code !== 'E811') {
                res.statusCode = 403
                return res.end(JSON.stringify({ code: 403, message: '没有计划验证日期编辑权限' }))
              }
              if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '填写日期格式不合法，请按 2026-08-26 格式填写' }))
              }
              if (value) {
                const first = new Date(`${String(issue.first_occurrence_date).slice(0, 10)}T00:00:00Z`)
                const planned = new Date(`${value}T00:00:00Z`)
                const latest = new Date(first.getTime() + 7 * 86400000)
                if (Number.isNaN(first.getTime()) || Number.isNaN(planned.getTime())) {
                  res.statusCode = 400
                  return res.end(JSON.stringify({ code: 400, message: '首次出现日期无效，无法填写计划验证日期' }))
                }
                if (planned > latest) {
                  res.statusCode = 400
                  return res.end(JSON.stringify({ code: 400, message: '计划验证日期不能超过首次出现日期后 7 个自然日' }))
                }
              }
              const normalizedBefore = String(issue.planned_completion_date || '').trim()
              if (normalizedBefore !== value) {
                const items = REPLAY_PLAN_DATE_CHANGES.get(issueId) || []
                replayPlanDateChangeSequence += 1
                items.unshift({
                  plannedCompletionDate: value || null,
                  operatorUsername: 'c-mock-current',
                  operatorRealName: '当前Mock用户',
                  changedAt: `2026-08-31 20:${String(replayPlanDateChangeSequence).padStart(2, '0')}:00`,
                })
                REPLAY_PLAN_DATE_CHANGES.set(issueId, items)
                issue.planned_completion_date = value
                issue.planned_completion_date_change_count = items.length
              }
              return ok(res, {
                id: issue.id,
                plannedCompletionDate: issue.planned_completion_date || null,
                changeCount: issue.planned_completion_date_change_count || 0,
              })
            })
          }
          if (req.method === 'PATCH') {
            const issueId = Number(url.match(/issues\/(\d+)/)?.[1] || 1)
            return readJsonBody(req).then((body) => {
              const issue = REPLAY_ISSUES.find(item => item.id === issueId)
              if (!issue) {
                res.statusCode = 404
                return res.end(JSON.stringify({ code: 404, message: '回放问题不存在' }))
              }
              const issueStatus = String(body.issueStatus || issue.issue_status || '').trim()
              let issueType = String(body.issueType || issue.issue_type || '').trim()
              if (issue.issue_status === '重新打开' && issueStatus === '打开') {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '重新打开的问题不能改回打开状态' }))
              }
              if (issueStatus === '无需处理' && !REPLAY_NO_ACTION_TYPES.has(issueType)) {
                res.statusCode = 400
                return res.end(JSON.stringify({ code: 400, message: '无需处理的问题类型只能选择：合理差异、规则性差异问题、外围问题' }))
              }
              if (issueStatus === '延后修复') issueType = '迁移问题'
              Object.assign(issue, {
                issue_status: issueStatus,
                issue_type: issueType,
                initial_analysis: body.initialAnalysis ?? issue.initial_analysis,
                final_solution: body.finalSolution ?? issue.final_solution,
                cooperation_person_username: body.cooperationPersonUsername ?? '',
                remark: body.remark ?? issue.remark,
              })
              return ok(res, issue)
            })
          }
          if (url.includes('/stats/planned-completion/date-points')) {
            const { datePoints, defaultStartDate, defaultEndDate } = replayCompletionRange(q)
            const counts = new Map()
            REPLAY_COMPLETION_ISSUES.forEach(issue => counts.set(issue.plannedCompletionDate, (counts.get(issue.plannedCompletionDate) || 0) + 1))
            return ok(res, {
              datePoints: datePoints.map(date => ({ date, plannedCount: counts.get(date) || 0 })),
              defaultStartDate,
              defaultEndDate,
            })
          }
          if (url.includes('/stats/planned-completion/issues')) {
            const { startDate, endDate } = replayCompletionRange(q)
            const matchedDeveloper = q.matchedDeveloper || null
            const groupField = q.groupBy === 'issueDomain' ? 'issueDomain' : 'groupName'
            const filtered = REPLAY_COMPLETION_ISSUES.filter(issue =>
              issue.plannedCompletionDate >= startDate && issue.plannedCompletionDate <= endDate
              && matchesReplayType(issue, q.replayType)
              && issue[groupField] === q.groupName
              && (!matchedDeveloper || issue.matchedDeveloper === matchedDeveloper)
              && replayCompletionCategory(issue) === q.category
            )
            const offset = Number(q.offset || 0)
            const limit = Number(q.limit || 20)
            return ok(res, { total: filtered.length, items: filtered.slice(offset, offset + limit), limit, offset, today: REPLAY_COMPLETION_TODAY })
          }
          if (url.includes('/stats/planned-completion')) return ok(res, replayCompletionDashboard(q))
          if (path.endsWith('/stats/groups')) return ok(res, replayIssueGroupSummaries(q))
          if (path.endsWith('/stats/person-ranking/schedule')) return ok(res, replayIssuePersonSchedule(q))
          if (path.endsWith('/stats/person-ranking')) return ok(res, replayIssuePersonRankings(q))
          if (url.includes('/mail-status')) {
            const issueId = Number(url.match(/issues\/(\d+)\//)?.[1] || 0)
            return ok(res, REPLAY_MAIL_STATUS.get(issueId) || {
              status: 'UNSENT', sentAt: null, recipientEmail: 'c-wangsh8@spdbdev.com', failureMessage: null,
              recipients: [
                { displayName: '张三', username: 'c-wangsh8', email: 'c-wangsh8@spdbdev.com', role: '协同人', status: 'UNSENT', sentAt: null, failureMessage: null },
                { displayName: '李四', username: 'lisi', email: 'lisi@example.com', role: '开发负责人', status: 'UNSENT', sentAt: null, failureMessage: null },
                { displayName: '王五', username: 'wangwu', email: 'wangwu@example.com', role: '科技负责人', status: 'UNSENT', sentAt: null, failureMessage: null },
              ],
            })
          }
          if (url.includes('/mail-send')) {
            const issueId = Number(url.match(/issues\/(\d+)\//)?.[1] || 0)
            const status = {
              status: 'FAILED', sentAt: null, recipientEmail: null, failureMessage: 'SMTP 连接超时（mock）',
              recipients: [
                { displayName: '张三', username: 'c-wangsh8', email: 'c-wangsh8@spdbdev.com', role: '协同人', status: 'SENT', sentAt: '2026-08-15 10:00:00', failureMessage: null },
                { displayName: '李四', username: 'lisi', email: 'lisi@example.com', role: '开发负责人', status: 'FAILED', sentAt: null, failureMessage: 'SMTP 连接超时（mock）' },
                { displayName: '王五', username: 'wangwu', email: 'wangwu@example.com', role: '科技负责人', status: 'SENT', sentAt: '2026-08-15 10:00:00', failureMessage: null },
              ],
            }
            REPLAY_MAIL_STATUS.set(issueId, status)
            return ok(res, status)
          }
          if (url.includes('/header-filter-option-counts')) return ok(res, replayHeaderFilterOptionCounts(q))
          if (url.includes('/header-filter-options')) return ok(res, replayHeaderFilterOptions(q))
          if (url.endsWith('/options')) return ok(res, { groups: REPLAY_GROUPS, issueLevels: REPLAY_LEVELS, issueTypes: REPLAY_TYPES, issueStatuses: REPLAY_STATUSES, coverageRounds: REPLAY_AVAILABLE_BATCHES })
          if (path.endsWith('/stats')) return ok(res, replayStatistics(q.groupBy, q.replayType))
          if (url.includes('/stats/')) return ok(res, [])
          const rows = replaySortRows(replayFilterRows(q), q)
          const offset = Number(q.offset || 0); const limit = Number(q.limit || 50)
          return ok(res, { total: rows.length, items: rows.slice(offset, offset + limit).map(row => ({ ...row, weekly_task: isReplayWeeklyTask(row) })) })
        }
        if (url.startsWith('/api/ai/parallel-replay/config/')) {
          return handleReplayConfig(req, res, parseQuery(url), path, replayConfigStore)
        }
        if (!url.startsWith('/api/ai/dao-index/') &&
            url !== '/api/flowtran/env' &&
            !url.startsWith('/api/system/build-sync-status') &&
            !url.startsWith('/api/system/stats')) {
          return next()
        }

        const q = parseQuery(url)
        const env = q.env || FIXED_ENV

        // 系统：环境信息
        if (url.startsWith('/api/flowtran/env')) {
          return ok(res, { env: 'uat', envs: ['dev', 'sit', 'uat'] })
        }
        if (url.startsWith('/api/system/build-sync-status')) {
          return ok(res, { lastSyncAt: new Date().toISOString(), status: 'DONE' })
        }
        if (url.startsWith('/api/system/stats')) {
          return ok(res, { domainCount: 4, transactionCount: 312, tableCount: 86 })
        }

        // 巡检任务列表
        // mock 里造两条任务：一条最新 RUNNING 中（模拟"正在跑"），一条上轮 DONE。
        // 加 status=DONE 过滤时只返回 DONE 那条 —— 与后端 list(env, 'DONE', 1) 行为对齐
        if (url.startsWith('/api/ai/dao-index/batch-tasks?') ||
            url === '/api/ai/dao-index/batch-tasks') {
          const items = getItems(env)
          const failed = items.filter(it => it.llm_status === 'FAILED').length
          const allTasks = [
            {
              id: FIXED_TASK_ID + 1,
              task_no: `${env.toUpperCase()}-2026-04-28-batch02`,
              env,
              status: 'RUNNING',
              total_sqls: items.length,
              analyzed_sqls: Math.floor(items.length * 0.4),
              failed_sqls: 0,
              created_at: '2026-04-28 01:00:05',
              finished_at: null,
            },
            {
              id: FIXED_TASK_ID,
              task_no: `${env.toUpperCase()}-2026-04-27-batch01`,
              env,
              status: 'DONE',
              total_sqls: items.length,
              analyzed_sqls: items.length,
              failed_sqls: failed,
              created_at: '2026-04-27 09:30:21',
              finished_at: '2026-04-27 10:14:08',
            },
          ]
          const status = q.status
          const filtered = status ? allTasks.filter(t => t.status === status) : allTasks
          return ok(res, filtered)
        }

        // 问题列表 KPI 统计：4 个数字一次出（与后端 /stats 端点对齐）
        if (url.startsWith('/api/ai/dao-index/debug/analysis-items-issues/stats')) {
          const all = getItems(env)
          const stats = { total: all.length, explainError: 0, llmFindings: 0, llmPending: 0, llmError: 0 }
          for (const it of all) {
            if (it.explain_error) stats.explainError++
            else if (it.llm_status === 'DONE')    stats.llmFindings++
            else if (it.llm_status === 'PENDING') stats.llmPending++
            else if (it.llm_status === 'FAILED')  stats.llmError++
          }
          return ok(res, stats)
        }

        // 问题列表
        if (url.startsWith('/api/ai/dao-index/debug/analysis-items-issues?') ||
            url === '/api/ai/dao-index/debug/analysis-items-issues') {
          const limit = Math.min(parseInt(q.limit || '500', 10) || 500, 500)
          const offset = parseInt(q.offset || '0', 10) || 0
          const all = getItems(env)
          const slice = all.slice(offset, offset + limit)
          return ok(res, {
            total: all.length,
            limit,
            offset,
            items: slice,
          })
        }

        // 详情页已下线，单条详情接口的 mock 也随之移除

        // 异步触发 LLM 重跑：mock 立即返回 PENDING，后台 5s 后把状态翻成 DONE
        if (url.match(/^\/api\/ai\/dao-index\/debug\/llm-analyze\/\d+\/async$/)) {
          const m = url.match(/\/llm-analyze\/(\d+)\/async/)
          const id = m ? Number(m[1]) : null
          // 立即把 mock 数据里的 llm_status 改为 PENDING
          const target = id == null ? null : ISSUES.find((it) => it.id === id)
          if (target) {
            target.llm_status = 'PENDING'
            target.llm_error = null
            target.llm_summary = null
            // 5s 后翻 DONE，模拟 LLM 跑完
            setTimeout(() => {
              target.llm_status = 'DONE'
              target.llm_summary = '【mock】异步分析完成，建议建合索引提升查询效率'
              target.llm_confidence = 'HIGH'
            }, 5000)
          }
          ok(res, { accepted: true, itemId: id, status: 'PENDING' })
          return
        }

        // 同步触发 LLM 重跑（旧接口，保留兼容）：1.8s 返回成功
        if (url.startsWith('/api/ai/dao-index/debug/llm-analyze/')) {
          setTimeout(() => ok(res, { triggered: true }), 1800)
          return
        }

        // Excel 导出：返回一个最小的"假 xlsx"占位（实际是 zip 头），供前端下载触发流程跑通
        if (url.startsWith('/api/ai/dao-index/debug/analysis-items-issues/export')) {
          // 返回一个 1x1 文本 xlsx 占位（PK 头表明是 zip 容器）。
          // 用户在浏览器会下载到一个名为 sql-analysis-issues-*.xlsx 的小文件，
          // 用于验证导出按钮链路；不追求真实 Excel 内容。
          const fname = `sql-analysis-issues-${env.toUpperCase()}-2026-04-27-batch01-mock.xlsx`
          res.statusCode = 200
          res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          )
          res.setHeader(
            'Content-Disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
          )
          // 写一个 PK 头（不是合法 xlsx，但浏览器能下载）
          res.end(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00]))
          return
        }

        return next()
      })
    },
  }
}
