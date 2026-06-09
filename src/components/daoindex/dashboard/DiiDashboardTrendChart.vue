<template>
  <section class="dii-panel trend-card">
    <div class="dii-panel__head">
      <div>
        <h3 class="dii-panel__title">近 7 天整改趋势</h3>
        <p class="dii-panel__desc">勾选领域与整改类型，按 (领域 × 类型) 叠加折线对比时间趋势（报错 / 需整改 / 白名单申请中 / 已申请白名单）。</p>
      </div>
    </div>

    <!-- 领域单选（radio）+ 整改类型多选 -->
    <div class="filters">
      <div class="filters__row">
        <span class="filters__label">领域</span>
        <label
          v-for="d in DOMAINS"
          :key="d"
          class="chk"
          :class="{ 'is-on': selDomain === d }"
        >
          <input type="radio" name="trend-domain" :value="d" v-model="selDomain" />
          <span>{{ d }}</span>
        </label>
      </div>
      <div class="filters__row">
        <span class="filters__label">类型</span>
        <label
          v-for="r in RATINGS"
          :key="r.key"
          class="chk"
          :class="{ 'is-on': selRatings.includes(r.key) }"
        >
          <input type="checkbox" :value="r.key" v-model="selRatings" />
          <i class="chk__dot" :style="{ background: r.color }"></i>
          <span>{{ r.label }}</span>
        </label>
      </div>
    </div>

    <!-- 图例：当前生效的每条线（颜色=整改类型，线型=领域） -->
    <div v-if="series.length" class="legend">
      <span v-for="s in series" :key="s.name" class="legend__item">
        <svg class="legend__line" width="26" height="8" aria-hidden="true">
          <line
            x1="0" y1="4" x2="26" y2="4"
            :stroke="s.color" stroke-width="2"
            :stroke-dasharray="s.dash || undefined"
          />
        </svg>
        {{ s.name }}
      </span>
    </div>

    <div class="trend-body">
      <DiiLineChart
        v-if="series.length"
        :categories="categories"
        :series="series"
        :height="240"
      />
      <div v-else class="trend-empty">请选择一个领域并至少勾选一个整改类型</div>
    </div>
  </section>
</template>

<script setup>
// 折线 + 领域&整改类型双维多选叉乘（与"整改分布"同口径）。
// 后端 trend7d 按 (task, domain) 返回整改口径，含
//   { task_id, day, domain, error_count, need_fix }
// 绘制线集合 = 选中领域 × 选中整改类型，每对组合一条线：
//   - color  按整改类型（var(--c-rating-*)）
//   - dash   按领域（实线/虚线/点线/点划线/长虚线）
//   - 「汇总」= 对每个 task 跨 domain 求和
import { ref, computed } from 'vue'
import DiiLineChart from '../widgets/DiiLineChart.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
})

const SUMMARY = '汇总'
const DOMAINS = [SUMMARY, '公共', '存款', '贷款', '结算']

// 整改类型 → 取数字段 + 固定颜色（与看板三图颜色常量保持一致）。
// RATINGS 变量名沿用（语义已是"整改类型"），避免大范围改名引入风险。
const RATINGS = [
  { key: 'error',       label: '报错',       field: 'error_count',  color: '#d4380d' },
  { key: 'need_fix',    label: '需整改',     field: 'need_fix',     color: '#e6a23c' },
  { key: 'wl_applying', label: '白名单申请中', field: 'wl_applying', color: '#fa8c16' },
  { key: 'wl_approved', label: '已申请白名单', field: 'wl_approved', color: '#722ed1' },
]

// 领域 → 线型（SVG stroke-dasharray）。汇总=实线，其余各异。
const DOMAIN_DASH = {
  [SUMMARY]: '',
  公共: '10 6',
  存款: '3 5',
  贷款: '14 5 3 5',
  结算: '18 8',
}

// 默认：领域单选=汇总；整改类型多选（报错 + 需整改 + 白名单申请中 + 已申请白名单）
const selDomain = ref(SUMMARY)
const selRatings = ref(['error', 'need_fix', 'wl_applying', 'wl_approved'])

// 按后端返回顺序抽取 7 个任务（task_id 去重，保插入序 = 时间正序）
const taskList = computed(() => {
  const seen = new Map() // task_id -> day
  for (const it of props.items) {
    if (!seen.has(it.task_id)) seen.set(it.task_id, it.day)
  }
  return [...seen.entries()].map(([taskId, day]) => ({ taskId, day }))
})

const categories = computed(() => taskList.value.map((t) => t.day))

// 某 (领域, 评级字段) 在各 task 的每日值
function valuesFor(domain, field) {
  return taskList.value.map(({ taskId }) => {
    let sum = 0
    for (const it of props.items) {
      if (it.task_id !== taskId) continue
      // 汇总=全 domain 累加；具体领域=仅该 domain
      if (domain !== SUMMARY && it.domain !== domain) continue
      sum += Number(it[field]) || 0
    }
    return sum
  })
}

// 领域单选 × 整改类型多选 → 折线集合（最多 2 条：报错 / 待整改）
const series = computed(() => {
  if (!selDomain.value || !selRatings.value.length) return []
  const d = selDomain.value
  const out = []
  for (const r of RATINGS) {
    if (!selRatings.value.includes(r.key)) continue
    out.push({
      name: `${d}·${r.label}`,
      color: r.color,
      dash: DOMAIN_DASH[d] || '',
      values: valuesFor(d, r.field),
    })
  }
  return out
})
</script>

<style scoped>
/* 面板 chrome 与其它 .dii-panel 一致 */
.dii-panel {
  padding: 20px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  box-shadow: 0 12px 28px rgba(31, 41, 55, 0.06);
}

.dii-panel__head {
  margin-bottom: 14px;
}

.dii-panel__title {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
}

.dii-panel__desc {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--text-faint);
}

/* ── 双多选筛选 ── */
.filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.filters__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filters__label {
  font-size: 12.5px;
  color: var(--text-muted);
  width: 32px;
  flex-shrink: 0;
}

.chk {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 12.5px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-badge);
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.chk:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.chk.is-on {
  background: var(--bg-card);
  border-color: var(--text-secondary);
  color: var(--text-primary);
}

/* 隐藏原生 checkbox，整个 pill 即点击区 */
.chk input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.chk__dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}

/* ── 生效线图例 ── */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin-bottom: 12px;
}

.legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.legend__line {
  display: block;
}

/* ── 图区 ── */
.trend-body {
  min-height: 260px;
}

.trend-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: var(--text-faint);
  font-size: 13px;
}

@media (max-width: 960px) {
  .filters__row {
    align-items: flex-start;
  }
}
</style>
