<template>
  <section class="dii-panel trend-card">
    <div class="dii-panel__head">
      <div>
        <h3 class="dii-panel__title">近 7 天评级趋势</h3>
        <p class="dii-panel__desc">每个 DONE 任务一根堆叠柱，观察四档评级随时间变化。</p>
      </div>
      <div class="legend">
        <span class="legend__item"><i class="legend__swatch is-excellent"></i>优</span>
        <span class="legend__item"><i class="legend__swatch is-good"></i>良</span>
        <span class="legend__item"><i class="legend__swatch is-poor"></i>差</span>
        <span class="legend__item"><i class="legend__swatch is-error"></i>报错</span>
      </div>
    </div>

    <!-- 领域单选切换：汇总（跨领域求和） / 各业务领域 -->
    <div class="domain-tabs" role="tablist">
      <button
        v-for="d in domainTabs"
        :key="d"
        type="button"
        role="tab"
        class="domain-tabs__btn"
        :class="{ 'is-active': activeDomain === d }"
        :aria-selected="activeDomain === d"
        @click="activeDomain = d"
      >{{ d }}</button>
    </div>

    <div class="trend-chart">
      <template v-if="columns.length">
        <div v-for="col in columns" :key="col.taskId" class="trend-chart__col">
          <div class="trend-chart__bar-wrap">
            <div
              class="trend-chart__stack"
              :style="{ height: stackHeight(col.total) }"
              :title="tooltip(col)"
            >
              <!-- column-reverse：模板里先写的在底部，故 优 在底、报错 在顶 -->
              <div class="seg is-excellent" :style="{ height: segHeight(col.excellent, col.total) }"></div>
              <div class="seg is-good"      :style="{ height: segHeight(col.good, col.total) }"></div>
              <div class="seg is-poor"      :style="{ height: segHeight(col.poor, col.total) }"></div>
              <div class="seg is-error"     :style="{ height: segHeight(col.error, col.total) }"></div>
            </div>
          </div>
          <div class="trend-chart__meta">
            <span class="trend-chart__day">{{ col.day }}</span>
            <span class="trend-chart__value">{{ col.total }}</span>
          </div>
        </div>
      </template>
      <div v-else class="trend-chart__empty">暂无数据</div>
    </div>
  </section>
</template>

<script setup>
// 趋势图：后端 trend7d 现按 (task, domain) 返回明细行
//   [{ task_id, day, domain, excellent, good, poor, error_count }, ...]
// 「汇总」= 对同一 task 跨 domain 求和；某领域 = 过滤该 domain。
import { ref, computed } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
})

// 单选 tab：汇总 + 四个业务领域（与后端 DOMAIN_CASE 输出一致）
const SUMMARY = '汇总'
const domainTabs = [SUMMARY, '公共', '存款', '贷款', '结算']
const activeDomain = ref(SUMMARY)

// 按当前选中口径，把明细行折叠成「每 task 一列」
const columns = computed(() => {
  const byTask = new Map() // task_id -> 聚合列
  for (const it of props.items) {
    // 非汇总时只取选中领域的行
    if (activeDomain.value !== SUMMARY && it.domain !== activeDomain.value) continue
    const key = it.task_id
    if (!byTask.has(key)) {
      byTask.set(key, {
        taskId: key,
        day: it.day,
        excellent: 0,
        good: 0,
        poor: 0,
        error: 0,
      })
    }
    const c = byTask.get(key)
    c.excellent += Number(it.excellent) || 0
    c.good += Number(it.good) || 0
    c.poor += Number(it.poor) || 0
    c.error += Number(it.error_count) || 0
  }
  const arr = [...byTask.values()]
  // 后端已 ORDER BY t.id ASC，Map 保持插入序 → 天然时间正序
  arr.forEach((c) => {
    c.total = c.excellent + c.good + c.poor + c.error
  })
  return arr
})

// 柱高按全局最大 total 归一，体现各任务体量差异
const maxTotal = computed(() =>
  Math.max(1, ...columns.value.map((c) => c.total)),
)

// 整根柱占满高的比例（编码 total 体量）
function stackHeight(total) {
  if (!total) return '0%'
  return `${Math.max(4, (total / maxTotal.value) * 100)}%`
}

// 单段占「本柱」的比例（四段之和恒为 100%）
function segHeight(value, total) {
  if (!total || !value) return '0%'
  return `${(value / total) * 100}%`
}

function tooltip(c) {
  return `${c.day}  优 ${c.excellent} / 良 ${c.good} / 差 ${c.poor} / 报错 ${c.error}（合计 ${c.total}）`
}
</script>

<style scoped>
/* 面板 chrome 与其它 .dii-panel 保持一致（沿用既有模式） */
.dii-panel {
  padding: 20px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  box-shadow: 0 12px 28px rgba(31, 41, 55, 0.06);
}

.dii-panel__head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
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

.legend {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.legend__swatch {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.legend__swatch.is-excellent { background: var(--c-rating-excellent); }
.legend__swatch.is-good      { background: var(--c-rating-good); }
.legend__swatch.is-poor      { background: var(--c-rating-poor); }
.legend__swatch.is-error     { background: var(--c-rating-error); }

/* ── 领域单选 tab ── */
.domain-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.domain-tabs__btn {
  padding: 5px 14px;
  font-size: 12.5px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-badge);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.domain-tabs__btn:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.domain-tabs__btn.is-active {
  background: var(--c-rating-good);
  border-color: var(--c-rating-good);
  color: #fff;
}

/* ── 堆叠柱 ── */
.trend-chart {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
  min-height: 220px;
}

.trend-chart__col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trend-chart__bar-wrap {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-height: 170px;
  padding: 12px 6px 0;
  border-radius: 16px;
  background: var(--bg-page);
}

.trend-chart__stack {
  width: 26px;
  display: flex;
  flex-direction: column-reverse; /* 第一个子元素（优）落在底部 */
  border-radius: 8px 8px 4px 4px;
  overflow: hidden;
}

.seg {
  width: 100%;
}

.seg.is-excellent { background: var(--c-rating-excellent); }
.seg.is-good      { background: var(--c-rating-good); }
.seg.is-poor      { background: var(--c-rating-poor); }
.seg.is-error     { background: var(--c-rating-error); }

.trend-chart__meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.trend-chart__day {
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.trend-chart__value {
  font-size: 11px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.trend-chart__empty {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
  font-size: 13px;
}

@media (max-width: 960px) {
  .dii-panel__head {
    flex-direction: column;
  }

  .trend-chart {
    gap: 8px;
  }
}
</style>
