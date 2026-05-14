<template>
  <section class="dii-panel trend-card">
    <div class="dii-panel__head">
      <div>
        <h3 class="dii-panel__title">近 7 天趋势</h3>
        <p class="dii-panel__desc">观察巡检量和高风险 SQL 是否同步升高。</p>
      </div>
      <div class="legend">
        <span class="legend__item"><i class="legend__swatch is-total"></i>巡检量</span>
        <span class="legend__item"><i class="legend__swatch is-poor"></i>高风险</span>
      </div>
    </div>

    <div class="trend-chart">
      <div v-for="item in items" :key="item.day" class="trend-chart__col">
        <div class="trend-chart__bars">
          <div class="trend-chart__bar-wrap">
            <div class="trend-chart__bar is-total" :style="{ height: barHeight(item.total) }"></div>
          </div>
          <div class="trend-chart__bar-wrap">
            <div class="trend-chart__bar is-poor" :style="{ height: barHeight(item.poor) }"></div>
          </div>
        </div>
        <div class="trend-chart__meta">
          <span class="trend-chart__day">{{ item.day }}</span>
          <span class="trend-chart__value">{{ item.total }} / {{ item.poor }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
})

const maxValue = computed(() => {
  const values = props.items.flatMap((item) => [item.total || 0, item.poor || 0])
  return Math.max(...values, 1)
})

function barHeight(value) {
  return `${Math.max(10, Math.round((value / maxValue.value) * 100))}%`
}
</script>

<style scoped>
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
  margin-bottom: 18px;
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

.legend__swatch.is-total { background: #6d4ce6; }
.legend__swatch.is-poor { background: #f76707; }

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

.trend-chart__bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  padding: 12px 6px 0;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(121,80,242,0.05), rgba(121,80,242,0.01));
}

.trend-chart__bar-wrap {
  width: 22px;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.trend-chart__bar {
  width: 100%;
  min-height: 10px;
  border-radius: 10px 10px 4px 4px;
}

.trend-chart__bar.is-total {
  background: linear-gradient(180deg, #8b5cf6, #6d4ce6);
}

.trend-chart__bar.is-poor {
  background: linear-gradient(180deg, #ffb168, #f76707);
}

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

@media (max-width: 960px) {
  .dii-panel__head {
    flex-direction: column;
  }

  .trend-chart {
    gap: 8px;
  }
}
</style>
