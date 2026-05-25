/**
 * 概览仪表盘 4 块结构的 mock 数据（v3 整改口径）。
 *
 * 数据契约与后端 GET /api/ai/dao-index/dashboard 完全一致，便于：
 *   - dev 环境后端没起时，前端自检布局
 *   - 后端不可达时自动降级展示
 *
 * 字段口径（v3：取消优良差评级，改"是否需整改"）：
 *   latestTask:       { id, task_no, env, created_at, updated_at, total_sqls, ... }
 *   byDomain[]:       { domain, total, explain_err, llm_fix }
 *                     llm_fix = 该领域 llm_fix_verdict='NEED_FIX' 的条数（需整改）
 *   ratingByDomain[]: { domain, error_count, need_fix }   ← 整改分布 2 档
 *                     error_count = EXPLAIN 报错；need_fix = 非报错 + POOR + NEED_FIX（待整改）
 *   trend7d[]:        { task_id, day, domain, error_count, need_fix }  ← 按 (任务×领域) 明细行，时间正序
 *   elapsed7d[]:      { task_id, day, elapsed_seconds, total_sqls }    时间正序
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
    explain_err: Math.round(base * 0.012),         // 1.2% EXPLAIN 报错
    llm_fix: Math.round(base * 0.08),              // 8% 经 AI 判定待整改
  }))
  const totalSqls = byDomain.reduce((sum, d) => sum + d.total, 0)

  // 第二块：整改分布（按领域，2 档：报错 / 待整改）
  // need_fix = 非报错 + overall_rating=POOR + llm_fix_verdict=NEED_FIX
  const ratingByDomain = byDomainScale.map(({ domain, base }) => {
    const errCount = Math.round(base * 0.012)
    const needFix = Math.round((base - errCount) * 0.09)   // 约 9% 待整改
    return { domain, error_count: errCount, need_fix: needFix }
  })

  // 第三块：7 天整改趋势 —— 按 (任务 × 领域) 明细行（前端按领域多选叉乘）
  // 每天一个 DONE 任务，每个任务下 5 个领域各一行
  const trend7d = []
  days.forEach((day, idx) => {
    const taskId = 100 + idx
    const seed = 0.85 + (idx / 6) * 0.3                     // 0.85 → 1.15 渐变
    byDomainScale.forEach(({ domain, base }) => {
      const dayBase = Math.round(base * seed)
      const errCount = Math.round(dayBase * 0.012)
      const needFix = Math.round((dayBase - errCount) * (0.07 + idx * 0.004))
      trend7d.push({ task_id: taskId, day, domain, error_count: errCount, need_fix: needFix })
    })
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
