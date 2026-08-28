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
const REPLAY_LEVELS = ['交易级', '字段级', '系统级']
const REPLAY_TYPES = ['迁移问题', '防腐问题', '代码问题', '新核心下线', '参数问题', '平台问题', '规则差异问题', '合理差异', '其他问题']
const REPLAY_STATUSES = ['新建', '打开', '延后修复', '修复待验证', '重新打开', '已修复']
const REPLAY_DEVELOPERS = ['张三(c-zhangs3)', '李四(c-lisi)', '王五(c-wangw5)', '赵六(c-zhaol6)']
const REPLAY_GROUP_SUMMARIES = REPLAY_GROUPS.map((groupName, index) => {
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
const REPLAY_PERSON_RANKINGS = Array.from({ length: 30 }, (_, index) => {
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
    rank: Math.floor(index / REPLAY_GROUPS.length) + 1,
    groupName: REPLAY_GROUPS[index % REPLAY_GROUPS.length],
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
const SPLIT_FILTER_COLUMNS = new Set(['occurrence_rounds', 'matched_developer', 'matched_bank_owner'])
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
  const occurrenceBatches = index < 30 ? ['MOCK-20260819']
    : index < 60 ? ['MOCK-20260815']
      : index < 85 ? ['MOCK-20260812'] : []
  if (index > 0 && index % 10 === 0) occurrenceBatches.push('MOCK-20260808')
  return {
    id: n, domain: groupName, group_name: groupName, issue_id: String(2900 + n), is_sandbox: false,
    transaction_code: `E${String(810 + (index % 24)).padStart(3, '0')}`, transaction_name: `回放交易${n}`,
    issue_level: REPLAY_LEVELS[index % REPLAY_LEVELS.length], field_name: '响应码', serial_no: `10150160${String(n).padStart(8, '0')}`,
    global_serial_no: `GS-${String(n).padStart(8, '0')}`, issue_description: `第${n}条回放问题描述`,
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
    affected_transaction_count: 1, issue_key: `MOCK-${String(n).padStart(4, '0')}`, historical_occurrence_count: 1,
    first_occurrence_date: '2026-08-12', last_occurrence_date: '2026-08-19', occurrence_rounds: occurrenceBatches.join('、'),
  }
})
const REPLAY_MAIL_STATUS = new Map()
let REPLAY_WEEKLY_TASK_BATCHES = ['MOCK-20260819']
const REPLAY_AVAILABLE_BATCHES = ['MOCK-20260808', 'MOCK-20260812', 'MOCK-20260815', 'MOCK-20260819']

const REPLAY_COMPLETION_DEVELOPERS = Array.from(
  { length: 15 },
  (_, index) => `开发负责人${String(index + 1).padStart(2, '0')}(c-dev${String(index + 1).padStart(2, '0')})`,
)
const REPLAY_COMPLETION_DEVELOPER_INDEXES = [
  0, 0, 0, 0, 0,
  1, 1, 1, 1,
  2, 2, 2,
  3, 3, 3,
  4, 4,
  5, 5,
  6, 6,
  7, 7,
  8, 9, 10, 11, 12, 13, 14,
]
const REPLAY_COMPLETION_DATES = Array.from(
  { length: 30 },
  (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`,
)
const REPLAY_COMPLETION_ISSUES = REPLAY_GROUPS.flatMap((groupName, groupIndex) =>
  Array.from({ length: 30 }, (_, index) => {
    const categoryIndex = index % 4
    const plannedDateIndex = groupIndex === 0
      ? index
      : (index * (groupIndex + 2) + groupIndex) % REPLAY_COMPLETION_DATES.length
    const plannedCompletionDate = REPLAY_COMPLETION_DATES[plannedDateIndex]
    const plannedTime = new Date(`${plannedCompletionDate}T00:00:00Z`)
    const repaired = new Date(plannedTime)
    if (categoryIndex === 0) repaired.setUTCDate(repaired.getUTCDate() - 1)
    if (categoryIndex === 1) repaired.setUTCDate(repaired.getUTCDate() + 3)
    const defectRepairDate = categoryIndex < 2 ? repaired.toISOString().slice(0, 10) : null
    const id = 5000 + groupIndex * 30 + index + 1
    return {
      id,
      issueId: `MOCK-C-${String(id).padStart(5, '0')}`,
      transactionCode: `C${groupIndex + 1}${String(index + 1).padStart(3, '0')}`,
      transactionName: `${groupName}计划完成跟踪交易${index + 1}`,
      issueStatus: defectRepairDate ? '已修复' : '打开',
      plannedCompletionDate,
      defectRepairDate,
      groupName,
      matchedDeveloper: REPLAY_COMPLETION_DEVELOPERS[
        (REPLAY_COMPLETION_DEVELOPER_INDEXES[index] + groupIndex) % REPLAY_COMPLETION_DEVELOPERS.length
      ],
      issueKey: `MOCK-COMPLETION-${groupIndex + 1}-${String(index + 1).padStart(2, '0')}`,
    }
  }),
)

function replayCompletionCategory(issue, today = '2026-08-27') {
  if (issue.defectRepairDate) return issue.defectRepairDate <= issue.plannedCompletionDate ? 'ON_TIME_FIXED' : 'LATE_FIXED'
  return today <= issue.plannedCompletionDate ? 'UNFINISHED' : 'OVERDUE_UNFINISHED'
}

function replayCompletionCounts(rows) {
  const counts = { onTimeFixedCount: 0, lateFixedCount: 0, unfinishedCount: 0, overdueUnfinishedCount: 0 }
  const fieldByCategory = {
    ON_TIME_FIXED: 'onTimeFixedCount',
    LATE_FIXED: 'lateFixedCount',
    UNFINISHED: 'unfinishedCount',
    OVERDUE_UNFINISHED: 'overdueUnfinishedCount',
  }
  rows.forEach(issue => { counts[fieldByCategory[replayCompletionCategory(issue)]] += 1 })
  const plannedTotal = rows.length
  const completionRate = plannedTotal ? Number((((counts.onTimeFixedCount + counts.lateFixedCount) * 100) / plannedTotal).toFixed(2)) : null
  return { plannedTotal, ...counts, completionRate }
}

function replayCompletionRange(q) {
  const datePoints = [...new Set(REPLAY_COMPLETION_ISSUES.map(issue => issue.plannedCompletionDate))].sort()
  const startDate = q.startDate
    ? (datePoints.find(date => date >= q.startDate) || datePoints.at(-1))
    : datePoints[Math.max(0, datePoints.length - 3)]
  const endDate = q.endDate
    ? ([...datePoints].reverse().find(date => date <= q.endDate) || datePoints[0])
    : datePoints.at(-1)
  return { datePoints, startDate, endDate }
}

function replayCompletionDashboard(q) {
  const { startDate, endDate } = replayCompletionRange(q)
  const rangeRows = REPLAY_COMPLETION_ISSUES.filter(issue => issue.plannedCompletionDate >= startDate && issue.plannedCompletionDate <= endDate)
  const groups = REPLAY_GROUPS.map(groupName => {
    const groupRows = rangeRows.filter(issue => issue.groupName === groupName)
    const developers = [...new Set(groupRows.map(issue => issue.matchedDeveloper))].sort().map(matchedDeveloper => ({
      matchedDeveloper,
      ...replayCompletionCounts(groupRows.filter(issue => issue.matchedDeveloper === matchedDeveloper)),
    }))
    return { groupName, ...replayCompletionCounts(groupRows), developers }
  })
  return {
    effectiveStartDate: startDate,
    effectiveEndDate: endDate,
    today: '2026-08-27',
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
  let rows = REPLAY_ISSUES
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
      const rowValues = SPLIT_FILTER_COLUMNS.has(column) ? splitFilterValues(r[column]) : [r[column]]
      return values.some(value => value === '空' ? isEmptyFilterValue(r[column]) : rowValues.includes(value))
    })
  }
  inFilter('transactionCodes', 'transaction_code')
  inFilter('groupNames', 'domain')
  inFilter('issueIds', 'issue_id')
  inFilter('issueLevels', 'issue_level')
  inFilter('serialNos', 'serial_no')
  inFilter('globalSerialNos', 'global_serial_no')
  inFilter('defectRepairDates', 'defect_repair_date')
  inFilter('plannedCompletionDates', 'planned_completion_date')
  inFilter('developers', 'matched_developer')
  inFilter('bankOwners', 'matched_bank_owner')
  inFilter('issueStatuses', 'issue_status')
  inFilter('issueTypes', 'issue_type')
  inFilter('cooperationPersons', 'cooperation_person_username')
  if (q.sandboxes) {
    const values = Array.isArray(q.sandboxes) ? q.sandboxes : [q.sandboxes]
    rows = rows.filter(r => values.includes(r.is_sandbox ? '是' : '否'))
  }
  if (q.keyword) rows = rows.filter(r => Object.values(r).some(v => String(v || '').includes(q.keyword)))
  return rows
}

// ────────────── Vite 插件 ──────────────

export function daoIndexMockPlugin() {
  return {
    name: 'dao-index-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (url.startsWith('/api/ai/parallel-replay/issues')) {
          const q = parseQuery(url)
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
            return ok(res, { editableGroups: ['公共组'] })
          }
          if (url.endsWith('/review-permissions')) {
            return ok(res, { reviewableGroups: [], reviewersByGroup: {}, reviewableTransactionCodes: [] })
          }
          if (req.method === 'PATCH' && url.includes('/planned-completion-date')) {
            const issueId = Number(url.match(/issues\/(\d+)/)?.[1] || 0)
            return readJsonBody(req).then((body) => {
              const issue = REPLAY_ISSUES.find(item => item.id === issueId)
              if (!issue) {
                res.statusCode = 404
                return res.end(JSON.stringify({ code: 404, message: '回放问题不存在' }))
              }
              issue.planned_completion_date = body.plannedCompletionDate || ''
              return ok(res, { ...issue, plannedCompletionDate: issue.planned_completion_date || null })
            })
          }
          if (req.method === 'PATCH') {
            const issueId = Number(url.match(/issues\/(\d+)/)?.[1] || 1)
            return ok(res, REPLAY_ISSUES.find(item => item.id === issueId) || REPLAY_ISSUES[0])
          }
          if (url.includes('/stats/planned-completion/date-points')) {
            const { datePoints } = replayCompletionRange(q)
            const counts = new Map()
            REPLAY_COMPLETION_ISSUES.forEach(issue => counts.set(issue.plannedCompletionDate, (counts.get(issue.plannedCompletionDate) || 0) + 1))
            return ok(res, {
              datePoints: datePoints.map(date => ({ date, plannedCount: counts.get(date) })),
              defaultStartDate: datePoints[Math.max(0, datePoints.length - 3)],
              defaultEndDate: datePoints.at(-1),
            })
          }
          if (url.includes('/stats/planned-completion/issues')) {
            const { startDate, endDate } = replayCompletionRange(q)
            const matchedDeveloper = q.matchedDeveloper || null
            const filtered = REPLAY_COMPLETION_ISSUES.filter(issue =>
              issue.plannedCompletionDate >= startDate && issue.plannedCompletionDate <= endDate
              && issue.groupName === q.groupName
              && (!matchedDeveloper || issue.matchedDeveloper === matchedDeveloper)
              && replayCompletionCategory(issue) === q.category
            )
            const offset = Number(q.offset || 0)
            const limit = Number(q.limit || 20)
            return ok(res, { total: filtered.length, items: filtered.slice(offset, offset + limit), limit, offset, today: '2026-08-27' })
          }
          if (url.includes('/stats/planned-completion')) return ok(res, replayCompletionDashboard(q))
          if (url.endsWith('/stats/groups')) return ok(res, REPLAY_GROUP_SUMMARIES)
          if (url.endsWith('/stats/person-ranking')) return ok(res, REPLAY_PERSON_RANKINGS)
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
          if (url.includes('/header-filter-options')) {
            const fieldMap = { groupName: 'domain', sandbox: 'is_sandbox', issueId: 'issue_id', transactionCode: 'transaction_code', issueLevel: 'issue_level', serialNo: 'serial_no', globalSerialNo: 'global_serial_no', defectRepairDate: 'defect_repair_date', developer: 'matched_developer', bankOwner: 'matched_bank_owner', issueStatus: 'issue_status', issueType: 'issue_type', cooperationPerson: 'cooperation_person_username', plannedCompletionDate: 'planned_completion_date', occurrenceBatch: 'occurrence_rounds' }
            const column = fieldMap[q.field]
            const rows = replayFilterRows(q)
            const candidateValue = row => q.field === 'sandbox' ? (row[column] ? '是' : '否') : row[column]
            const hasEmpty = rows.some(row => isEmptyFilterValue(candidateValue(row)))
            const values = [...new Set(rows.flatMap(row => SPLIT_FILTER_COLUMNS.has(column) ? splitFilterValues(candidateValue(row)) : [candidateValue(row)]).filter(v => !isEmptyFilterValue(v)))].sort()
            if (hasEmpty) values.unshift('空')
            const filtered = values.filter(v => !q.keyword || (v === '空' ? q.keyword === '空' : v.includes(q.keyword)))
            return ok(res, filtered)
          }
          if (url.endsWith('/options')) return ok(res, { groups: REPLAY_GROUPS, issueLevels: REPLAY_LEVELS, issueTypes: REPLAY_TYPES, issueStatuses: REPLAY_STATUSES, coverageRounds: REPLAY_AVAILABLE_BATCHES })
          if (url.endsWith('/stats')) return ok(res, { total: 100, newTotal: 17, openTotal: 17, reopenedTotal: 17, deferredTotal: 17, pendingVerificationTotal: 16, fixedTotal: 16, groupCounts: {} })
          if (url.includes('/stats/')) return ok(res, [])
          const rows = replayFilterRows(q)
          const offset = Number(q.offset || 0); const limit = Number(q.limit || 50)
          return ok(res, { total: rows.length, items: rows.slice(offset, offset + limit).map(row => ({ ...row, weekly_task: isReplayWeeklyTask(row) })) })
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
