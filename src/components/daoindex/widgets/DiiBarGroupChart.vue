<template>
  <!--
    纯 div 实现的"分组柱状图"通用组件（项目无 echarts 等图表库，沿用既有 trend chart 风格）

    数据契约：
      categories: ['存款', '贷款', ...]      横轴分类标签数组
      series: [
        { name: '巡检 SQL', color: '#xxx', values: [120, 80, ...] },
        { name: '报错',     color: '#xxx', values: [12, 3, ...] },
        ...
      ]
      values 长度必须等于 categories 长度，否则按 categories 截断/补 0。

    渲染规则：
      - 每个 category 是一组并排柱子（每个 series 一根柱）
      - 所有柱共享同一个 Y 轴刻度（max = 全局最大值）
      - 单值 hover 显示 tooltip
      - 0 值柱保留 1px 高度作为占位（避免完全不可见）
  -->
  <div class="dii-chart">
    <div v-if="!hasData" class="dii-chart-empty">暂无数据</div>
    <template v-else>
      <!-- Y 轴刻度区 -->
      <div class="dii-chart-yaxis">
        <div v-for="(label, i) in yAxisLabels" :key="i" class="dii-chart-ytick">
          <span class="dii-chart-ylabel">{{ label }}</span>
          <div class="dii-chart-yline"></div>
        </div>
      </div>
      <!-- 柱状区 -->
      <div class="dii-chart-bars">
        <div
          v-for="(cat, ci) in categories"
          :key="ci"
          class="dii-chart-group"
        >
          <div class="dii-chart-group-bars">
            <div
              v-for="(s, si) in series"
              :key="si"
              class="dii-chart-bar"
              :style="{
                height: barHeight(s.values?.[ci] || 0),
                background: s.color,
              }"
              :title="`${s.name}: ${formatValue(s.values?.[ci] || 0)}${valueSuffix || ''}（${cat}）`"
            >
              <!-- 大于 0 的柱顶上挂数字标签（小数据更直观） -->
              <span
                v-if="(s.values?.[ci] || 0) > 0"
                class="dii-chart-bar-label"
              >{{ formatValue(s.values[ci]) }}</span>
            </div>
          </div>
          <div class="dii-chart-group-label">{{ cat }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  series: { type: Array, default: () => [] },
  /** 高度（柱状区高度，不含底部标签），px */
  height: { type: Number, default: 220 },
  /** 数字格式化后缀，如 ' min'、'%' 等 */
  valueSuffix: { type: String, default: '' },
})

const hasData = computed(() => {
  if (!props.categories?.length || !props.series?.length) return false
  // 至少有一个非 0 值才算有效数据，避免"全 0"也展示空柱
  return props.series.some(s =>
    Array.isArray(s?.values) && s.values.some(v => Number(v) > 0)
  )
})

const maxValue = computed(() => {
  let m = 0
  for (const s of props.series || []) {
    for (const v of s?.values || []) {
      const n = Number(v) || 0
      if (n > m) m = n
    }
  }
  // 防 0：避免除以 0；同时让最大柱不顶到顶（留 8% 余量）
  return Math.max(m * 1.08, 1)
})

// Y 轴 4 档刻度，从大到小排：100% / 75% / 50% / 25%
const yAxisLabels = computed(() => {
  const max = maxValue.value
  return [max, max * 0.75, max * 0.5, max * 0.25].map(v => formatValue(v))
})

function barHeight(v) {
  const n = Number(v) || 0
  if (n <= 0) return '1px'  // 0 值保留 1px 作为占位
  // 计算高度 px（针对 height 区间），最低保 4px 让小数值可见
  const px = Math.max(4, Math.round((n / maxValue.value) * props.height))
  return `${px}px`
}

function formatValue(v) {
  const n = Number(v) || 0
  // 整数千分位；小数（如分钟带小数）保留 1 位
  if (Number.isInteger(n)) return n.toLocaleString('en-US')
  return n.toFixed(1)
}
</script>

<style scoped>
.dii-chart {
  display: flex;
  align-items: flex-end;
  min-height: 260px;
  padding: 12px 0 0;
}

.dii-chart-empty {
  flex: 1;
  text-align: center;
  padding: 60px 0;
  color: var(--text-faint, #8990a0);
  font-size: 13px;
}

/* Y 轴刻度区 */
.dii-chart-yaxis {
  width: 56px;
  flex-shrink: 0;
  height: v-bind('height + "px"');
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
}
.dii-chart-ytick {
  display: flex;
  align-items: center;
  width: 100%;
  position: relative;
}
.dii-chart-ylabel {
  width: 48px;
  padding-right: 6px;
  text-align: right;
  font-size: 11px;
  color: var(--text-faint, #8990a0);
  font-family: ui-monospace, monospace;
}
.dii-chart-yline {
  flex: 1;
  height: 1px;
  background: var(--border-subtle, #ebeef2);
  position: absolute;
  left: 56px;
  right: 0;
  width: calc(100vw - 200px);  /* 任意大值，被 chart-bars 容器宽度截断 */
  max-width: 100%;
}

/* 柱状区 */
.dii-chart-bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: v-bind('(height + 28) + "px"');
  border-left: 1px solid var(--border-subtle, #ebeef2);
  padding-left: 8px;
  position: relative;
  z-index: 1;  /* 让柱子盖在 yline 上方 */
}

.dii-chart-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 160px;
  min-width: 60px;
}

.dii-chart-group-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: v-bind('height + "px"');
  width: 100%;
  justify-content: center;
}

.dii-chart-bar {
  flex: 1;
  max-width: 28px;
  min-width: 14px;
  border-radius: 3px 3px 0 0;
  transition: opacity 0.15s ease;
  cursor: default;
  position: relative;
}
.dii-chart-bar:hover {
  opacity: 0.85;
}
.dii-chart-bar-label {
  position: absolute;
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--text-secondary, #5a6172);
  white-space: nowrap;
  font-family: ui-monospace, monospace;
}

.dii-chart-group-label {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary, #5a6172);
  text-align: center;
  word-break: keep-all;
  white-space: nowrap;
}

/* dark：刻度线和文字微调 */
[data-theme="dark"] .dii-chart-yline { background: rgba(255,255,255,0.08); }
[data-theme="dark"] .dii-chart-bars { border-left-color: rgba(255,255,255,0.08); }
[data-theme="dark"] .dii-chart-bar-label { color: var(--text-secondary, #9aa0aa); }
</style>
