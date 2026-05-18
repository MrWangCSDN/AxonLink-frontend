<template>
  <section class="dii-panel trend-card">
    <div class="dii-panel__head">
      <div>
        <h3 class="dii-panel__title">近 7 天评级趋势</h3>
        <p class="dii-panel__desc">勾选领域与评级，按 (领域 × 评级) 叠加折线对比时间趋势。</p>
      </div>
    </div>

    <!-- 两组多选：领域 / 评级 -->
    <div class="filters">
      <div class="filters__row">
        <span class="filters__label">领域</span>
        <label
          v-for="d in DOMAINS"
          :key="d"
          class="chk"
          :class="{ 'is-on': selDomains.includes(d) }"
        >
          <input type="checkbox" :value="d" v-model="selDomains" />
          <span>{{ d }}</span>
        </label>
      </div>
      <div class="filters__row">
        <span class="filters__label">评级</span>
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

    <!-- 图例：当前生效的每条线（颜色=评级，线型=领域） -->
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
      <div v-else class="trend-empty">请至少选择一个领域和一个评级</div>
    </div>
  </section>
</template>

<script setup>
// v3：折线 + 领域&评级双维多选叉乘。
// 后端 trend7d（commit 9912de4）已按 (task, domain) 返回，含
//   { task_id, day, domain, excellent, good, poor, error_count }
// 绘制线集合 = 选中领域 × 选中评级，每对组合一条线：
//   - color  按评级（var(--c-rating-*)）
//   - dash   按领域（实线/虚线/点线/点划线/长虚线）
//   - 「汇总」= 对每个 task 跨 domain 求和
import { ref, computed } from 'vue'
import DiiLineChart from '../widgets/DiiLineChart.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
})

const SUMMARY = '汇总'
const DOMAINS = [SUMMARY, '公共', '存款', '贷款', '结算']

// 评级 → 取数字段 + 颜色 token。颜色统一走 v2 已建的 --c-rating-*
const RATINGS = [
  { key: 'excellent', label: '优', field: 'excellent', color: 'var(--c-rating-excellent)' },
  { key: 'good', label: '良', field: 'good', color: 'var(--c-rating-good)' },
  { key: 'poor', label: '差', field: 'poor', color: 'var(--c-rating-poor)' },
  { key: 'error', label: '报错', field: 'error_count', color: 'var(--c-rating-error)' },
]

// 领域 → 线型（SVG stroke-dasharray）。汇总=实线，其余各异。
const DOMAIN_DASH = {
  [SUMMARY]: '',
  公共: '10 6',
  存款: '3 5',
  贷款: '14 5 3 5',
  结算: '18 8',
}

// 默认：汇总 + 四档全选（等价 v1 折线）
const selDomains = ref([SUMMARY])
const selRatings = ref(['excellent', 'good', 'poor', 'error'])

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

// 笛卡尔积生成折线集合
const series = computed(() => {
  if (!selDomains.value.length || !selRatings.value.length) return []
  const out = []
  for (const d of DOMAINS) {
    if (!selDomains.value.includes(d)) continue
    for (const r of RATINGS) {
      if (!selRatings.value.includes(r.key)) continue
      out.push({
        name: `${d}·${r.label}`,
        color: r.color,
        dash: DOMAIN_DASH[d] || '',
        values: valuesFor(d, r.field),
      })
    }
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
