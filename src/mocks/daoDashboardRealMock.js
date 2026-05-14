/**
 * 概览仪表盘新 4 块结构的 mock 数据。
 *
 * 数据契约与后端 GET /api/ai/dao-index/dashboard 完全一致，便于：
 *   - dev 环境后端没起时，前端自检布局
 *   - 后端不可达时自动降级展示
 *
 * 字段口径：
 *   latestTask: { id, task_no, env, created_at, updated_at, total_sqls, ... }
 *   byDomain[]: { domain, total, explain_err, llm_fix }
 *   ratingByDomain[]: { domain, excellent, good, poor, error_count }
 *   trend7d[]: { task_id, day, excellent, good, poor, error_count }    时间正序
 *   elapsed7d[]: { task_id, day, elapsed_seconds, total_sqls }         时间正序
 */

const DOMAINS = ['存款', '贷款', '公共', '结算', '其他']

/** 生成一组按领域分布的伪随机数（保证按"存款 > 贷款 > 公共 > 结算 > 其他"的趋势） */
function genDomainScale(seed = 1) {
  const base = [1200, 800, 500, 300, 90].map(n => Math.round(n * (0.85 + seed * 0.08)))
  return DOMAINS.map((d, i) => ({ domain: d, base: base[i] }))
}

/** 最近 7 天的"伪日期"（含今日），格式 'YYYY-MM-DD' */
function recent7Days() {
  const out = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function getDaoDashboardRealMock(env = 'uat') {
  const days = recent7Days()
  const lastDay = days[days.length - 1]

  // 第一块：按领域聚合（基于 seed=1）
  const byDomainScale = genDomainScale(1)
  const byDomain = byDomainScale.map(({ domain, base }) => ({
    domain,
    total: base,
    explain_err: Math.round(base * 0.012),         // 1.2% EXPLAIN 错
    llm_fix: Math.round(base * 0.05),              // 5% LLM 已整改
  }))
  const totalSqls = byDomain.reduce((sum, d) => sum + d.total, 0)

  // 第二块：评级分布（按领域，4 档互斥）
  const ratingByDomain = byDomainScale.map(({ domain, base }) => {
    const errCount = Math.round(base * 0.012)
    const valid = base - errCount
    const excellent = Math.round(valid * 0.65)
    const good = Math.round(valid * 0.22)
    const poor = valid - excellent - good
    return { domain, excellent, good, poor, error_count: errCount }
  })

  // 第三块：7 天趋势（每天一个任务）
  const trend7d = days.map((day, idx) => {
    const seed = 0.85 + (idx / 6) * 0.3        // 0.85 → 1.15 渐变
    const dayTotal = Math.round(totalSqls * seed)
    const errCount = Math.round(dayTotal * 0.012)
    const valid = dayTotal - errCount
    const excellent = Math.round(valid * (0.6 + idx * 0.01))
    const good = Math.round(valid * 0.22)
    const poor = valid - excellent - good
    return {
      task_id: 100 + idx,
      day,
      excellent,
      good,
      poor,
      error_count: errCount,
    }
  })

  // 第四块：7 天耗时（伪随机：受日总量影响 + 偶尔抖动）
  const elapsed7d = days.map((day, idx) => ({
    task_id: 100 + idx,
    day,
    elapsed_seconds: Math.round(900 + idx * 80 + Math.sin(idx * 1.7) * 200),  // 15min ~ 25min
    total_sqls: Math.round(totalSqls * (0.85 + idx * 0.05)),
  }))

  return {
    env,
    latestTask: {
      id: 106,
      task_no: `DII-MOCK-${lastDay.replace(/-/g, '')}-${env}`,
      env,
      created_at: `${lastDay} 01:00:05`,
      updated_at: `${lastDay} 01:24:12`,
      total_sqls: totalSqls,
      analyzed_sqls: totalSqls,
      failed_sqls: 0,
      skipped_sqls: 0,
    },
    byDomain,
    ratingByDomain,
    trend7d,
    elapsed7d,
  }
}
