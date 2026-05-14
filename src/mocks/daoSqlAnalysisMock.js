/**
 * SQL 巡检 · SQL 分析明细 Mock
 *
 * 本文件为 SQL 分析页（DaoSqlList.vue）提供可分页、可筛选的虚拟数据，
 * 用于后端 /ai/dao-index/debug/analysis-items 接口不可用时的前端自测。
 *
 * 数据特征：
 *  - 按固定 seed 生成，同一环境每次返回完全一致的数据，不抖动
 *  - 每个环境的数据总量与 dashboard KPI 对齐（dev 428 / sit 863 / uat 1284）
 *  - "差 SQL"在领域内分布与 daoDashboardMock.js 的 poorDomainDistribution 大致同比例
 *
 * 字段口径（每条 SQL 分析结果）：
 *  - id              ： 自增唯一 ID，形如 "UAT-A00001"
 *  - env             ： 所属环境（dev / sit / uat）
 *  - domain          ： SQL 所属业务领域 key
 *  - domainLabel     ： 领域中文名，供表格直接渲染
 *  - source          ： SQL 来源中文名（用于表格展示）
 *  - sourceType      ： 来源枚举值（用于筛选 / 样式）
 *  - classFqn        ： 全限定类名（DAO / Mapper）
 *  - methodName      ： 方法名
 *  - sqlKind         ： SQL 类型（SELECT / UPDATE / INSERT / DELETE）
 *  - sqlText         ： 完整 SQL 原文（可能很长，表格悬停展示）
 *  - sqlPreview      ： SQL 预览（截断后的短字符串）
 *  - involvedTables  ： 涉及表数组
 *  - sqlHash         ： SQL 指纹
 *  - ruleRating      ： 规则引擎评级（POOR / GOOD / EXCELLENT / NOT_APPLICABLE）
 *  - explainRating   ： 执行计划评级
 *  - aiStatus        ： AI 分析状态（DONE / PENDING / FAILED / SKIPPED）
 *  - aiRating        ： AI 分析评级（仅 aiStatus=DONE 时有值）
 *  - aiAdvice        ： AI 分析建议（短摘要，仅 DONE 时有值）
 *  - aiConfidence    ： AI 置信度（0–1，仅 DONE 时有值）
 *  - aiLatencyMs     ： AI 分析耗时毫秒（仅 DONE 时有值）
 *  - createdAt       ： 创建时间字符串（YYYY-MM-DD HH:MM:SS）
 *  - taskId          ： 所属巡检任务 ID
 *
 * 对外导出：
 *  - listDaoSqlAnalyses(params)  ：分页查询
 *  - getDaoSqlAnalysis(id)       ：按 ID 查单条（供详情页）
 *  - runDaoSqlAiAnalyze(id)      ：mock "执行" 按钮（重跑 AI 分析）
 *  - DAO_SQL_PAGE_SIZE_OPTIONS   ：分页器下拉候选
 */

/* ──────────────── 常量字典 ──────────────── */

/** 与 dashboard 顶部"差 SQL 领域分布"保持一致的 6 个领域 */
const DOMAINS = [
  { key: 'account', label: '账户核算' },
  { key: 'transaction', label: '交易撮合' },
  { key: 'clearing', label: '清算结算' },
  { key: 'customer', label: '客户信息' },
  { key: 'interbank', label: '跨行/接口' },
  { key: 'other', label: '其他' },
]

/** SQL 来源类型字典 */
const SOURCES = [
  { type: 'dao', label: 'DAO 方法扫描' },
  { type: 'mybatis', label: 'MyBatis Mapper' },
  { type: 'slow-log', label: 'MySQL 慢日志' },
  { type: 'runtime-trace', label: '运行时链路采样' },
  { type: 'manual', label: '人工导入' },
]

/** 四档评级 */
const RATINGS = ['POOR', 'GOOD', 'EXCELLENT', 'NOT_APPLICABLE']

/** AI 分析状态 */
const AI_STATUSES = ['DONE', 'DONE', 'DONE', 'DONE', 'PENDING', 'FAILED', 'SKIPPED']
//  ↑ 故意把 DONE 的权重拉高（7 选 4），贴近真实场景：大部分已分析完，少量挂起/失败/跳过

/** 分页器下拉的页大小候选 */
export const DAO_SQL_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/** 每个环境的大致数据总量（与 dashboard 的 SQL 总数 KPI 对齐） */
const ENV_TOTAL = {
  dev: 428,
  sit: 863,
  uat: 1284,
}

/* ──────────────── SQL 语句模板 ──────────────── */
/*
 * 每个模板包含：
 *  - kind        SQL 类型
 *  - domain      建议挂靠的领域
 *  - tables      涉及表
 *  - template    SQL 原文模板（含 {{seq}} 占位符，保证不同条 ID 的 SQL 仍可区分）
 *  - classSeeds  来自哪些类（生成 classFqn 用）
 *  - adviceSeeds AI 建议候选池
 */
const SQL_TEMPLATES = [
  {
    kind: 'SELECT',
    domain: 'account',
    tables: ['T_ACC_BALANCE', 'T_ACC_CORE_INFO'],
    template: `SELECT a.acc_no, a.acc_name, a.acc_status, b.balance_amt, b.available_amt, b.update_time
FROM T_ACC_BALANCE b
LEFT JOIN T_ACC_CORE_INFO a ON a.acc_no = b.acc_no
WHERE b.acc_status = '1'
  AND b.update_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  /* seq = {{seq}} */
ORDER BY b.update_time DESC
LIMIT 500`,
    classSeeds: ['com.bank.core.account.dao.AccountBalanceDao', 'com.bank.core.account.mapper.AccBalanceMapper'],
    methodSeeds: ['listActiveBalances', 'queryRecentBalances', 'selectBalanceByStatus'],
    adviceSeeds: [
      '建议在 (acc_status, update_time) 上建联合索引；当前 ORDER BY 字段和过滤字段顺序不匹配，MySQL 会回表排序 50w+ 行，强烈建议改为覆盖索引。',
      '检测到 LEFT JOIN 左右表顺序可能反了：小表 T_ACC_CORE_INFO 应作为驱动表。建议改写为子查询先筛日期区间再 JOIN。',
    ],
  },
  {
    kind: 'SELECT',
    domain: 'transaction',
    tables: ['T_TXN_JOURNAL', 'T_ORDER_MATCH_LOG'],
    template: `SELECT j.txn_id, j.txn_amt, j.txn_status, j.create_time, o.order_id, o.match_result
FROM T_TXN_JOURNAL j
INNER JOIN T_ORDER_MATCH_LOG o ON o.txn_id = j.txn_id
WHERE j.create_time BETWEEN '2026-04-01 00:00:00' AND '2026-04-22 23:59:59'
  AND j.txn_status IN ('SUCCESS','PARTIAL_SUCCESS')
  /* seq = {{seq}} */
  AND o.match_result != 'FAILED'
ORDER BY j.create_time DESC, j.txn_id DESC`,
    classSeeds: ['com.bank.txn.dao.TxnJournalDao', 'com.bank.txn.mapper.OrderMatchMapper'],
    methodSeeds: ['listTxnWithMatch', 'queryDailyTxn', 'selectByTimeRange'],
    adviceSeeds: [
      'T_TXN_JOURNAL 单表约 2.3 亿行，按 create_time 区间扫描性能极差，建议按日分区 + 在 (create_time, txn_status) 上建复合索引。',
      'JOIN 后的 ORDER BY 会触发 filesort，建议拆成两步：先取 txn_id 列表，再按 id 批量回查。',
    ],
  },
  {
    kind: 'SELECT',
    domain: 'clearing',
    tables: ['T_BIZ_CLEAR_TXN', 'T_CLEAR_BATCH_LOG'],
    template: `SELECT c.clear_id, c.clear_amt, c.clear_status, c.clear_date, l.batch_no, l.batch_status
FROM T_BIZ_CLEAR_TXN c
LEFT JOIN T_CLEAR_BATCH_LOG l ON l.batch_no = c.batch_no
WHERE c.clear_date = CURDATE()
  AND c.clear_status IN ('PENDING','RETRY')
  /* seq = {{seq}} */
  AND (l.batch_status IS NULL OR l.batch_status != 'DONE')`,
    classSeeds: ['com.bank.clear.dao.ClearTxnDao', 'com.bank.clear.mapper.ClearBatchMapper'],
    methodSeeds: ['listPendingClear', 'queryTodayRetry', 'selectUnmatchedBatch'],
    adviceSeeds: [
      'T_BIZ_CLEAR_TXN 对 clear_date 没有索引，CURDATE() 使查询无法走分区裁剪，建议强制走 clear_date 索引。',
      'IS NULL 组合 != 会导致优化器放弃索引，建议改为 NOT EXISTS 子查询。',
    ],
  },
  {
    kind: 'SELECT',
    domain: 'customer',
    tables: ['T_CUST_PROFILE', 'T_CUST_CERT'],
    template: `SELECT p.cust_id, p.cust_name, p.cust_level, c.cert_type, c.cert_no, c.cert_status
FROM T_CUST_PROFILE p
LEFT JOIN T_CUST_CERT c ON c.cust_id = p.cust_id
WHERE p.cust_name LIKE CONCAT('%', ?, '%')
  /* seq = {{seq}} */
  AND p.cust_level >= 3
  AND (c.cert_status = '1' OR c.cert_status IS NULL)`,
    classSeeds: ['com.bank.cust.dao.CustProfileDao', 'com.bank.cust.mapper.CustCertMapper'],
    methodSeeds: ['searchCustByName', 'fuzzyQueryCustomer', 'listHighLevelCust'],
    adviceSeeds: [
      'LIKE "%xxx%" 无法走索引，全表扫描约 1.2 亿行。建议接入 Elasticsearch 做模糊搜索，或至少改为前缀匹配 "xxx%"。',
      '置客户信息的模糊检索到搜索引擎，数据库只承担精确查询。',
    ],
  },
  {
    kind: 'UPDATE',
    domain: 'account',
    tables: ['T_ACC_BALANCE'],
    template: `UPDATE T_ACC_BALANCE
SET balance_amt = balance_amt + ?,
    update_time = NOW(),
    update_seq = update_seq + 1
WHERE acc_no = ?
  AND acc_status = '1'
  /* seq = {{seq}} */`,
    classSeeds: ['com.bank.core.account.dao.AccountBalanceDao'],
    methodSeeds: ['increaseBalance', 'updateBalanceByAccNo'],
    adviceSeeds: [
      'UPDATE 使用了累加写入，存在并发脏写风险。建议加乐观锁 (WHERE update_seq = ?) 或改用行级悲观锁。',
    ],
  },
  {
    kind: 'SELECT',
    domain: 'interbank',
    tables: ['T_INTERBANK_TRACE', 'T_BANK_ROUTE'],
    template: `SELECT t.trace_no, t.send_bank, t.recv_bank, t.trace_status, r.route_code
FROM T_INTERBANK_TRACE t
LEFT JOIN T_BANK_ROUTE r ON r.bank_code = t.recv_bank
WHERE t.trace_status IN ('SENDING','TIMEOUT')
  AND t.create_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
  /* seq = {{seq}} */
ORDER BY t.create_time`,
    classSeeds: ['com.bank.interbank.dao.InterbankTraceDao'],
    methodSeeds: ['listPendingTrace', 'queryTimeoutTrace'],
    adviceSeeds: [
      '1 小时窗口的全表扫描在 UAT 压测会堵住连接池，建议对 (trace_status, create_time) 建联合索引。',
      'T_BANK_ROUTE 是小字典表，建议放本地 Caffeine 缓存，避免每条链路都 JOIN。',
    ],
  },
  {
    kind: 'DELETE',
    domain: 'other',
    tables: ['T_GL_TRACE_LOG'],
    template: `DELETE FROM T_GL_TRACE_LOG
WHERE create_time < DATE_SUB(NOW(), INTERVAL 90 DAY)
  /* seq = {{seq}} */
LIMIT 10000`,
    classSeeds: ['com.bank.ops.dao.GlTraceCleanDao'],
    methodSeeds: ['cleanExpiredTraces'],
    adviceSeeds: [
      '一次 DELETE 10000 行会长时间持有行锁。建议分小批量 1000 行一次 + sleep，或改为 pt-archiver。',
    ],
  },
  {
    kind: 'INSERT',
    domain: 'transaction',
    tables: ['T_TXN_JOURNAL'],
    template: `INSERT INTO T_TXN_JOURNAL
(txn_id, txn_amt, txn_status, acc_no, create_time, create_by)
VALUES
(?, ?, 'INIT', ?, NOW(), ?)
/* seq = {{seq}} */`,
    classSeeds: ['com.bank.txn.dao.TxnJournalDao'],
    methodSeeds: ['insertNewTxn'],
    adviceSeeds: [
      '建议改为 INSERT 批量写入（rewriteBatchedStatements=true），单条插入在高峰 TPS 会被连接池压力放大 3 倍。',
    ],
  },
]

/* ──────────────── 工具：种子随机 ──────────────── */

/**
 * 线性同余 PRNG：同一 seed 每次生成同样序列。
 * 用来保证 mock 数据"稳定"——刷新页面不抖动。
 */
function createRng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/** 从数组里按随机值挑一个元素 */
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

/** 按权重挑领域：账户/交易占比最高，其他递减 */
const DOMAIN_WEIGHTS = [
  { key: 'account', weight: 0.28 },
  { key: 'transaction', weight: 0.22 },
  { key: 'clearing', weight: 0.18 },
  { key: 'customer', weight: 0.16 },
  { key: 'interbank', weight: 0.1 },
  { key: 'other', weight: 0.06 },
]

function pickDomainByWeight(rng) {
  const r = rng()
  let acc = 0
  for (const d of DOMAIN_WEIGHTS) {
    acc += d.weight
    if (r < acc) return d.key
  }
  return 'other'
}

/** 按环境给评级一个不同的分布：uat 最差、dev 最好 */
function pickRating(rng, env) {
  const r = rng()
  if (env === 'dev') {
    if (r < 0.05) return 'POOR'
    if (r < 0.55) return 'GOOD'
    if (r < 0.9) return 'EXCELLENT'
    return 'NOT_APPLICABLE'
  }
  if (env === 'sit') {
    if (r < 0.07) return 'POOR'
    if (r < 0.57) return 'GOOD'
    if (r < 0.85) return 'EXCELLENT'
    return 'NOT_APPLICABLE'
  }
  // uat
  if (r < 0.07) return 'POOR'
  if (r < 0.55) return 'GOOD'
  if (r < 0.82) return 'EXCELLENT'
  return 'NOT_APPLICABLE'
}

/** 2026-04-22 00:00:00 到 2026-04-23 09:00:00 之间的随机时间，格式 YYYY-MM-DD HH:MM:SS */
function pickCreatedAt(rng) {
  // 起点：2026-04-22 00:00:00  时间戳
  const start = new Date('2026-04-22T00:00:00').getTime()
  const end = new Date('2026-04-23T09:00:00').getTime()
  const t = start + Math.floor(rng() * (end - start))
  const d = new Date(t)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 给一个 SQL 模板渲染 seq，并返回 sqlText / sqlPreview 对 */
function renderSql(template, seq) {
  const sqlText = template.replace('{{seq}}', String(seq).padStart(5, '0'))
  const oneLine = sqlText.replace(/\s+/g, ' ').trim()
  const sqlPreview = oneLine.length > 120 ? oneLine.slice(0, 117) + '...' : oneLine
  return { sqlText, sqlPreview }
}

/** 简易 hash：把字符串稳定压到 16 位 hex */
function hashHex(str) {
  let h1 = 0x811c9dc5
  let h2 = 0xdeadbeef
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ c, 2246822507) >>> 0
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 16)
}

/* ──────────────── 核心：按环境生成所有数据 ──────────────── */

/**
 * 按环境生成所有 SQL 分析数据（全量数组，后续由 listDaoSqlAnalyses 做分页）
 * 用 Map 做惰性缓存，同一环境只会生成一次。
 */
const ITEMS_CACHE = new Map()

function buildItemsByEnv(env) {
  if (ITEMS_CACHE.has(env)) return ITEMS_CACHE.get(env)

  const total = ENV_TOTAL[env] || ENV_TOTAL.uat
  const envSeed = { dev: 1001, sit: 2002, uat: 3003 }[env] || 3003
  const rng = createRng(envSeed)

  const envPrefix = env.toUpperCase() // "DEV" / "SIT" / "UAT"
  const list = []

  for (let i = 1; i <= total; i++) {
    // ── 1. 选模板：大部分条目与模板的领域一致，小概率串领域（模拟真实项目里领域边界模糊） ──
    const template = pick(rng, SQL_TEMPLATES)
    const domain = rng() < 0.85 ? template.domain : pickDomainByWeight(rng)
    const domainMeta = DOMAINS.find((d) => d.key === domain) || DOMAINS[5]

    // ── 2. 来源：按常见比例分配 ──
    const sourceMeta = pick(rng, SOURCES)

    // ── 3. 类 / 方法 ──
    const classFqn = pick(rng, template.classSeeds)
    const methodName = pick(rng, template.methodSeeds || ['execute'])

    // ── 4. SQL 原文 ──
    const { sqlText, sqlPreview } = renderSql(template.template, i)

    // ── 5. 三个评级独立抽取，基于环境分布 ──
    const ruleRating = pickRating(rng, env)
    // 执行计划评级倾向比规则更严格一些：差+10%、优-5%
    const explainRating = (() => {
      const r = pickRating(rng, env)
      if (r === 'GOOD' && rng() < 0.15) return 'POOR'
      if (r === 'EXCELLENT' && rng() < 0.1) return 'GOOD'
      return r
    })()

    // ── 6. AI 分析状态 + 相关字段 ──
    const aiStatus = pick(rng, AI_STATUSES)
    let aiRating = null
    let aiAdvice = ''
    let aiConfidence = null
    let aiLatencyMs = null
    if (aiStatus === 'DONE') {
      aiRating = pickRating(rng, env)
      aiAdvice = pick(rng, template.adviceSeeds)
      // 置信度：0.65 ~ 0.98，保留两位
      aiConfidence = Math.round((0.65 + rng() * 0.33) * 100) / 100
      // 耗时：2500 ~ 18000 ms
      aiLatencyMs = 2500 + Math.floor(rng() * 15500)
    } else if (aiStatus === 'FAILED') {
      aiAdvice = 'LLM 调用失败：gateway timeout after 120s'
    } else if (aiStatus === 'SKIPPED') {
      aiAdvice = '规则评级为"不适用"，已跳过 AI 分析'
    }

    // ── 7. 其他辅助字段 ──
    const id = `${envPrefix}-A${String(i).padStart(5, '0')}`
    const taskId = `${envPrefix}-240422-${String(((i - 1) % 20) + 1).padStart(2, '0')}`
    const sqlHash = hashHex(`${env}|${i}|${classFqn}|${methodName}`)

    list.push({
      id,
      env,
      domain: domainMeta.key,
      domainLabel: domainMeta.label,
      source: sourceMeta.label,
      sourceType: sourceMeta.type,
      classFqn,
      methodName,
      sqlKind: template.kind,
      sqlText,
      sqlPreview,
      involvedTables: template.tables,
      sqlHash,
      ruleRating,
      explainRating,
      aiStatus,
      aiRating,
      aiAdvice,
      aiConfidence,
      aiLatencyMs,
      createdAt: pickCreatedAt(rng),
      taskId,
    })
  }

  ITEMS_CACHE.set(env, list)
  return list
}

/* ──────────────── 对外 API：分页 / 筛选 / 取单条 ──────────────── */

/**
 * 分页查询 SQL 分析结果（mock 版 listDiiItems）
 *
 * @param {object} params
 * @param {'dev'|'sit'|'uat'} [params.env='uat']
 * @param {number} [params.page=1]              页码，从 1 开始
 * @param {number} [params.pageSize=20]         每页条数；不在候选内会被夹到最近的候选
 * @param {string} [params.domain]              领域筛选（account/transaction/...）
 * @param {string} [params.sourceType]          来源筛选
 * @param {string} [params.ruleRating]          规则评级 POOR/GOOD/EXCELLENT/NOT_APPLICABLE
 * @param {string} [params.explainRating]       执行计划评级
 * @param {string} [params.aiRating]            AI 评级
 * @param {string} [params.aiStatus]            AI 分析状态
 * @param {string} [params.keyword]             关键词：命中 sqlText / classFqn / methodName / 涉及表
 * @param {string} [params.taskId]              任务 ID
 * @returns {{ items: Array, total: number, page: number, pageSize: number, pageSizeOptions: number[] }}
 */
export function listDaoSqlAnalyses(params = {}) {
  const {
    env = 'uat',
    page = 1,
    pageSize = 20,
    domain = '',
    sourceType = '',
    ruleRating = '',
    explainRating = '',
    aiRating = '',
    aiStatus = '',
    keyword = '',
    taskId = '',
  } = params

  // 规范化 pageSize
  const safePageSize = DAO_SQL_PAGE_SIZE_OPTIONS.includes(pageSize)
    ? pageSize
    : DAO_SQL_PAGE_SIZE_OPTIONS.reduce((prev, cur) =>
        Math.abs(cur - pageSize) < Math.abs(prev - pageSize) ? cur : prev,
      )

  // 拉全量再过滤（mock 场景总量不大，最多 1284，随便过滤）
  const all = buildItemsByEnv(env)
  const kw = keyword.trim().toLowerCase()

  const filtered = all.filter((it) => {
    if (domain && it.domain !== domain) return false
    if (sourceType && it.sourceType !== sourceType) return false
    if (ruleRating && it.ruleRating !== ruleRating) return false
    if (explainRating && it.explainRating !== explainRating) return false
    if (aiRating && it.aiRating !== aiRating) return false
    if (aiStatus && it.aiStatus !== aiStatus) return false
    if (taskId && it.taskId !== taskId) return false
    if (kw) {
      const hay = (
        it.sqlText + ' ' +
        it.classFqn + ' ' +
        it.methodName + ' ' +
        it.involvedTables.join(' ')
      ).toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })

  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / safePageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * safePageSize
  const items = filtered.slice(start, start + safePageSize)

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    pageSizeOptions: DAO_SQL_PAGE_SIZE_OPTIONS.slice(),
  }
}

/**
 * 按 ID 取单条 SQL 分析结果（列表页简版字段）
 * @param {string} id
 * @returns {object|null}
 */
export function getDaoSqlAnalysis(id) {
  if (!id) return null
  // 从 id 前缀推出 env
  const prefix = id.split('-')[0].toLowerCase()
  const env = ['dev', 'sit', 'uat'].includes(prefix) ? prefix : 'uat'
  const all = buildItemsByEnv(env)
  return all.find((it) => it.id === id) || null
}

/**
 * 按 ID 取 SQL 分析的"详情快照"（供 DaoSqlDetail.vue 用）
 *
 * 详情页模板直接面向后端的 snake_case + JSON 字符串化字段（历史原因），
 * 本函数把列表条目扩展到同样的结构，方便前端模板零改动消费。
 *
 * @param {string} id
 * @returns {object|null}
 */
export function getDaoSqlAnalysisDetail(id) {
  const base = getDaoSqlAnalysis(id)
  if (!base) return null

  // 同一 id 每次返回同样的衍生字段：用 id 做 seed
  const rng = createRng(hashToInt(id + ':detail'))

  // ── 1. EXPLAIN 基础指标：偏向 explainRating ──
  //  差 → cost 高、估算行数多、有 seq scan；优 → 相反
  const isExplainPoor = base.explainRating === 'POOR'
  const isExplainExcellent = base.explainRating === 'EXCELLENT'

  const explain_top_cost = isExplainPoor
    ? Math.round((8000 + rng() * 24000) * 10) / 10
    : isExplainExcellent
      ? Math.round((20 + rng() * 200) * 10) / 10
      : Math.round((500 + rng() * 3500) * 10) / 10

  const explain_est_rows = isExplainPoor
    ? Math.round(500_000 + rng() * 2_500_000)
    : isExplainExcellent
      ? Math.round(1 + rng() * 200)
      : Math.round(5_000 + rng() * 80_000)

  const explain_has_seq_scan = isExplainPoor ? rng() < 0.75 : rng() < 0.15

  const explain_elapsed_ms = isExplainPoor
    ? Math.round(800 + rng() * 5200)
    : isExplainExcellent
      ? Math.round(3 + rng() * 40)
      : Math.round(80 + rng() * 500)

  const explain_plan = buildExplainPlan(base, {
    explain_top_cost,
    explain_est_rows,
    explain_has_seq_scan,
  })

  // ── 2. 规则 vs EXPLAIN 分歧 ──
  const isDisagree = base.ruleRating !== base.explainRating &&
    // "不适用" 不算分歧
    base.ruleRating !== 'NOT_APPLICABLE' &&
    base.explainRating !== 'NOT_APPLICABLE'
  const disagreement_reason = isDisagree
    ? buildDisagreeReason(base.ruleRating, base.explainRating)
    : null

  // ── 3. 表级评级 + 索引清单 ──
  const tableRatings = base.involvedTables.map((tb) =>
    buildTableRating(tb, base, rng),
  )
  const table_ratings_json = JSON.stringify(tableRatings)

  // ── 4. LLM 结果：DONE 才有 findings / suggestions ──
  let llm_findings_json = JSON.stringify([])
  let llm_suggestions_json = JSON.stringify([])
  let llm_summary = null
  let warnings_json = null

  if (base.aiStatus === 'DONE') {
    const findings = buildFindings(base, rng)
    const suggestions = buildSuggestions(base, rng)
    llm_findings_json = JSON.stringify(findings)
    llm_suggestions_json = JSON.stringify(suggestions)
    llm_summary = buildLlmSummary(base)
    // 偶尔挂一两条警告
    if (rng() < 0.35) {
      warnings_json = JSON.stringify(buildWarnings(base, rng))
    }
  }

  // ── 5. 工程名（从 classFqn 反推，比 "axon-link" 这种单字符串更真实） ──
  const project_name = deriveProjectName(base.classFqn)

  // ── 6. 组装后端 snake_case 形态 ──
  return {
    // 基础
    id: base.id,
    env: base.env,
    project_name,
    class_fqn: base.classFqn,
    method_name: base.methodName,
    sql_hash: base.sqlHash,
    sql_kind: base.sqlKind,
    sql_text: base.sqlText,
    created_at: base.createdAt,
    task_id: base.taskId,

    // 评级（详情页模板里 overall_rating 指"规则引擎评级"，runtime_rating 指 EXPLAIN）
    overall_rating: base.ruleRating,
    runtime_rating: base.explainRating,
    disagreement: isDisagree ? 1 : 0,
    disagreement_reason,

    // EXPLAIN
    explain_top_cost,
    explain_est_rows,
    explain_has_seq_scan,
    explain_elapsed_ms,
    explain_plan,
    explain_error: null,

    // 涉及表
    table_ratings_json,

    // LLM 主块
    llm_status: base.aiStatus,
    llm_pending: base.aiStatus === 'PENDING',
    llm_error: base.aiStatus === 'FAILED' ? 'gateway timeout after 120s' : null,
    llm_summary,
    llm_confidence: base.aiConfidence != null
      ? `${Math.round(base.aiConfidence * 100)}%`
      : null,
    llm_model: base.aiStatus === 'DONE' ? 'gpt-4o-2024-08-06' : null,
    llm_prompt_version: base.aiStatus === 'DONE' ? 'v3.2.1' : null,
    llm_elapsed_ms: base.aiLatencyMs,
    llm_findings_json,
    llm_suggestions_json,

    // 额外
    warnings_json,

    // 保留一份驼峰原始字段，方便未来模板需要时读取
    _raw: base,
  }
}

/**
 * Mock "执行" 按钮：重新触发一次 AI 分析（伪异步）
 *
 * 行为：置 aiStatus=DONE，重抽 aiRating/aiAdvice/aiConfidence/aiLatencyMs。
 * 返回一个 Promise，模拟 1.2s 的调用延迟。
 *
 * @param {string} id
 * @returns {Promise<object>} 更新后的 item
 */
export function runDaoSqlAiAnalyze(id) {
  return new Promise((resolve, reject) => {
    const item = getDaoSqlAnalysis(id)
    if (!item) {
      reject(new Error(`未找到 SQL 分析记录：${id}`))
      return
    }
    setTimeout(() => {
      // 以 id 做 seed，保证同一条多次"执行"结果稳定
      const rng = createRng(hashToInt(id))
      item.aiStatus = 'DONE'
      item.aiRating = pickRating(rng, item.env)
      const tpl = SQL_TEMPLATES.find((t) => t.tables.some((tb) => item.involvedTables.includes(tb)))
      item.aiAdvice = pick(rng, (tpl && tpl.adviceSeeds) || ['重新分析完成，暂未检测到明显问题。'])
      item.aiConfidence = Math.round((0.7 + rng() * 0.28) * 100) / 100
      item.aiLatencyMs = 2200 + Math.floor(rng() * 12000)
      resolve({ ...item })
    }, 1200)
  })
}

/** 字符串 → 32 位正整数（用作种子） */
function hashToInt(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0
  }
  return h || 1
}

/* ──────────────── 导出字典（给筛选器用） ──────────────── */

export const DAO_SQL_DOMAINS = DOMAINS.slice()
export const DAO_SQL_SOURCES = SOURCES.slice()
export const DAO_SQL_RATINGS = RATINGS.slice()

/* ══════════════════════════════════════════════════════════════════
 * 详情页辅助：把一个 base item 扩展成完整详情 snapshot 所需的各种碎片。
 * 这些函数没有副作用，纯靠 seed RNG 决定输出，保证同 id 同结果。
 * ══════════════════════════════════════════════════════════════════ */

/** 从 classFqn 反推一个像样的工程名，例如 com.bank.txn.* → axon-txn-core */
function deriveProjectName(classFqn) {
  if (!classFqn) return 'axon-link-backend'
  const parts = classFqn.split('.')
  // com.bank.<module>.*
  const mod = parts[2] || parts[1] || 'core'
  return `axon-${mod}-core`
}

/** 构造分歧原因 */
function buildDisagreeReason(ruleRating, explainRating) {
  const ruleTxt = RATING_TO_LABEL[ruleRating] || ruleRating
  const expTxt = RATING_TO_LABEL[explainRating] || explainRating
  // 规则偏严 / EXPLAIN 偏松 → 以 EXPLAIN 为准
  if (ruleRating === 'POOR' && explainRating === 'GOOD') {
    return `规则评级为"${ruleTxt}"，但 EXPLAIN 在测试库数据量下未见明显问题（${expTxt}），可能测试数据量不足以触发规则预判的性能瓶颈。`
  }
  if (ruleRating === 'GOOD' && explainRating === 'POOR') {
    return `规则评级为"${ruleTxt}"，但生产 EXPLAIN 采样显示已触发全表扫描，表现为"${expTxt}"，疑似运行时统计信息与规则引擎预期不符。`
  }
  return `规则评级 ${ruleTxt}，EXPLAIN 评级 ${expTxt}，出现分歧，建议人工复核。`
}

const RATING_TO_LABEL = {
  POOR: '差',
  GOOD: '良',
  EXCELLENT: '优',
  NOT_APPLICABLE: '不适用',
}

/** 构造单张表的评级 + 可用索引清单（包含"本 SQL 命中"标注） */
function buildTableRating(tableName, base, rng) {
  // 表评级：大概率贴近总评
  const rating = rng() < 0.7
    ? base.ruleRating
    : RATINGS[Math.floor(rng() * RATINGS.length)]

  // 该表一定有 PRIMARY，多数情况下还有 1-3 个二级索引
  const availableIndexes = [
    {
      indexName: 'PRIMARY',
      primary: true,
      unique: true,
      columns: ['id'],
    },
  ]
  // 根据表名猜几个合理的二级索引
  const secondaryGuess = guessSecondaryIndexes(tableName, rng)
  availableIndexes.push(...secondaryGuess)

  // 命中索引：POOR 时大概率没命中（null），其他时候命中一个非主键索引
  let matchedIndex = null
  if (rating !== 'POOR' && availableIndexes.length > 1 && rng() < 0.85) {
    const pick = availableIndexes[1 + Math.floor(rng() * (availableIndexes.length - 1))]
    matchedIndex = {
      indexName: pick.indexName,
      matchedColumnCount: 1 + Math.floor(rng() * pick.columns.length),
      totalColumnCount: pick.columns.length,
    }
  }

  const reason = rating === 'POOR'
    ? '未命中任何索引，全表扫描 ' + (base.sqlKind === 'DELETE' ? '+ 大批量删除' : '+ 高估行数')
    : rating === 'EXCELLENT'
      ? '命中覆盖索引'
      : null

  return {
    table: tableName,
    rating,
    reason,
    availableIndexes,
    matchedIndex,
  }
}

/** 根据表名猜几个合理的二级索引 */
function guessSecondaryIndexes(tableName, rng) {
  const idxSeedMap = {
    T_ACC_BALANCE: [
      { indexName: 'idx_acc_status_time', columns: ['acc_status', 'update_time'] },
      { indexName: 'uk_acc_no', unique: true, columns: ['acc_no'] },
    ],
    T_ACC_CORE_INFO: [
      { indexName: 'uk_acc_no', unique: true, columns: ['acc_no'] },
      { indexName: 'idx_cust_id', columns: ['cust_id'] },
    ],
    T_TXN_JOURNAL: [
      { indexName: 'idx_create_time', columns: ['create_time'] },
      { indexName: 'idx_acc_txn', columns: ['acc_no', 'txn_status'] },
    ],
    T_ORDER_MATCH_LOG: [
      { indexName: 'idx_txn_id', columns: ['txn_id'] },
      { indexName: 'idx_order_id', columns: ['order_id'] },
    ],
    T_BIZ_CLEAR_TXN: [
      { indexName: 'idx_clear_date_status', columns: ['clear_date', 'clear_status'] },
    ],
    T_CLEAR_BATCH_LOG: [
      { indexName: 'uk_batch_no', unique: true, columns: ['batch_no'] },
    ],
    T_CUST_PROFILE: [
      { indexName: 'idx_cust_name', columns: ['cust_name'] },
      { indexName: 'idx_cust_level', columns: ['cust_level'] },
    ],
    T_CUST_CERT: [
      { indexName: 'idx_cust_id', columns: ['cust_id'] },
    ],
    T_INTERBANK_TRACE: [
      { indexName: 'idx_trace_status_time', columns: ['trace_status', 'create_time'] },
    ],
    T_BANK_ROUTE: [
      { indexName: 'uk_bank_code', unique: true, columns: ['bank_code'] },
    ],
    T_GL_TRACE_LOG: [
      { indexName: 'idx_create_time', columns: ['create_time'] },
    ],
  }
  const defaults = [{ indexName: 'idx_create_time', columns: ['create_time'] }]
  const seeds = idxSeedMap[tableName] || defaults
  // 随机保留 0-2 个二级索引（避免每张表一样）
  const keep = Math.max(1, Math.floor(rng() * (seeds.length + 1)))
  return seeds.slice(0, keep).map((idx) => ({ ...idx }))
}

/** 构造 LLM findings（0-3 条） */
function buildFindings(base, rng) {
  const pool = []
  if (base.ruleRating === 'POOR' || base.explainRating === 'POOR') {
    pool.push({
      severity: 'HIGH',
      type: 'MISSING_INDEX',
      description: `在 ${base.involvedTables[0]} 的过滤/排序列上缺少合适索引，触发全表扫描。`,
      evidence: `EXPLAIN 显示 type=ALL, rows≈${Math.round(500000 + rng() * 2000000)}`,
    })
  }
  if (base.sqlKind === 'SELECT' && base.sqlText.includes('LIKE')) {
    pool.push({
      severity: 'MEDIUM',
      type: 'LEADING_WILDCARD_LIKE',
      description: 'LIKE 使用前导 % 通配，索引失效。',
      evidence: "cust_name LIKE CONCAT('%', ?, '%')",
    })
  }
  if (base.sqlKind === 'SELECT' && /JOIN/i.test(base.sqlText)) {
    pool.push({
      severity: 'MEDIUM',
      type: 'JOIN_ORDER_SUBOPTIMAL',
      description: 'JOIN 驱动表选择不当，小表应作为驱动表。',
      evidence: '左表数据量约 2.3 亿，右表约 120 万',
    })
  }
  if (base.sqlKind === 'UPDATE' || base.sqlKind === 'DELETE') {
    pool.push({
      severity: 'HIGH',
      type: 'LARGE_BATCH_DML',
      description: '单条语句影响范围大，长时间持有行锁/表锁。',
      evidence: '未显式限制 LIMIT 或事务粒度过大',
    })
  }
  if (base.aiConfidence != null && base.aiConfidence < 0.75) {
    pool.push({
      severity: 'LOW',
      type: 'CONFIDENCE_LOW',
      description: 'LLM 置信度较低，建议人工复核建议内容。',
      evidence: `confidence=${Math.round(base.aiConfidence * 100)}%`,
    })
  }
  return pool.slice(0, Math.min(pool.length, 1 + Math.floor(rng() * 3)))
}

/** 构造 LLM suggestions（1-2 条） */
function buildSuggestions(base, rng) {
  const suggestions = []
  const mainTable = base.involvedTables[0] || 'T_UNKNOWN'

  // SQL 级重写
  if (base.ruleRating === 'POOR' || base.explainRating === 'POOR') {
    suggestions.push({
      scope: 'SQL',
      type: 'REWRITE_SQL',
      priority: 1,
      newSql: rewriteSqlSample(base),
      reason: '减少左表扫描量，按日期窗口预筛后再 JOIN，大幅降低 rows 预估。',
      riskWarning: null,
    })
  }

  // 表级 DDL
  if (base.ruleRating === 'POOR' || base.explainRating === 'POOR') {
    const ddl = `CREATE INDEX idx_${mainTable.toLowerCase()}_auto ON ${mainTable} (create_time, status);`
    suggestions.push({
      scope: 'TABLE',
      type: 'ADD_INDEX',
      priority: 2,
      ddl,
      estimatedKeyLength: 24,
      exceedsLengthLimit: false,
      reason: '基于访问模式补齐复合索引，期望将 rows 估算从 120 万降至数千。',
      riskWarning: rng() < 0.3
        ? '新增索引会增加写入开销约 5-8%，建议灰度观察。'
        : null,
    })
  } else {
    // 评级不差时也给一条"轻量优化"
    suggestions.push({
      scope: 'SQL',
      type: 'HINT_OPTIMIZATION',
      priority: 3,
      newSql: null,
      reason: 'SQL 当前性能可接受，可考虑限制返回字段范围，减少网络开销。',
      riskWarning: null,
    })
  }
  return suggestions
}

/** 简易 SQL 重写示例（展示用） */
function rewriteSqlSample(base) {
  if (!base.sqlText.includes('JOIN')) return base.sqlText
  return `-- 重写后：先用日期区间缩量，再 JOIN
WITH recent AS (
  SELECT ${base.involvedTables[0].toLowerCase().slice(2)}_id
  FROM ${base.involvedTables[0]}
  WHERE create_time BETWEEN ? AND ?
)
SELECT t.*
FROM recent r
JOIN ${base.involvedTables[1] || base.involvedTables[0]} t ON t.id = r.${base.involvedTables[0].toLowerCase().slice(2)}_id
ORDER BY t.create_time DESC
LIMIT 500;`
}

/** LLM 摘要（取 advice 前 80 字 + 统一包装） */
function buildLlmSummary(base) {
  const brief = base.aiAdvice.length > 100 ? base.aiAdvice.slice(0, 97) + '...' : base.aiAdvice
  return `【AI 概览】${brief}`
}

/** 警告 */
function buildWarnings(base, rng) {
  const pool = [
    `AI 建议中的 DDL 尚未在测试环境验证，预计需要 ${Math.round(10 + rng() * 40)} 分钟的索引构建时间。`,
    'EXPLAIN 采样来自只读副本，与主库可能有秒级统计差异。',
    '模型 Token 用量接近上限，复杂 SQL 可能被截断分析。',
  ]
  // 挑 1-2 条
  const n = 1 + Math.floor(rng() * 2)
  return pool.slice(0, n)
}

/** EXPLAIN 计划的简化 JSON（树状） */
function buildExplainPlan(base, metrics) {
  const { explain_top_cost, explain_est_rows, explain_has_seq_scan } = metrics
  const rootType = explain_has_seq_scan ? 'Seq Scan' : 'Index Scan'
  const rootPlan = {
    'Node Type': rootType,
    'Relation Name': base.involvedTables[0],
    'Total Cost': explain_top_cost,
    'Plan Rows': explain_est_rows,
    'Index Name': explain_has_seq_scan ? null : 'idx_auto_guess',
  }
  // 多表 JOIN 加一层 Nested Loop
  if (base.involvedTables.length > 1) {
    return {
      'Node Type': 'Nested Loop',
      'Total Cost': explain_top_cost,
      'Plan Rows': explain_est_rows,
      Plans: [
        rootPlan,
        {
          'Node Type': 'Index Scan',
          'Relation Name': base.involvedTables[1],
          'Index Name': 'PRIMARY',
          'Total Cost': Math.round(explain_top_cost * 0.2 * 10) / 10,
          'Plan Rows': Math.round(explain_est_rows * 0.01),
        },
      ],
    }
  }
  return rootPlan
}
