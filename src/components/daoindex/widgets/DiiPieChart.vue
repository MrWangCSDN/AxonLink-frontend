<template>
  <!--
    纯 SVG 饼图（用于"占比/分布"展示）。

    数据契约：取 series[0]（单系列），按 categories 各自的 values 切片。
      categories: ['05-07', '05-08', ...]
      series: [
        { name: '执行时长', color: '#xxx', values: [15, 19.6, ...] }
      ]

    渲染规则：
      - 切片大小 = value / sum(all values)
      - 切片颜色：从 SLICE_PALETTE 自动循环（保证相邻不重色）
      - 中心放总数（可选 subTitle）
      - 右侧图例：每项含色块 + category + value + 百分比
      - 鼠标 hover 切片：略微放大 + 提示
  -->
  <div class="dii-pie-wrap">
    <div v-if="!hasData" class="dii-pie-empty">暂无数据</div>
    <template v-else>
      <!-- SVG 饼图 -->
      <div class="dii-pie-svg-wrap">
        <svg :viewBox="viewBox" class="dii-pie-svg" xmlns="http://www.w3.org/2000/svg">
          <!-- 背景圆（避免合计 < 100% 时露底色） -->
          <circle :cx="cx" :cy="cy" :r="radius" fill="var(--bg-card, #fff)" />
          <!-- 各切片（path） -->
          <g>
            <path
              v-for="(slice, i) in slices"
              :key="i"
              :d="slice.d"
              :fill="slice.color"
              :stroke="strokeColor"
              stroke-width="1.5"
              class="dii-pie-slice"
            >
              <title>{{ slice.label }}: {{ formatValue(slice.value) }}{{ valueSuffix }}（{{ slice.pct }}%）</title>
            </path>
          </g>
          <!-- 中心圆（甜甜圈风格 + 中心写总数） -->
          <circle :cx="cx" :cy="cy" :r="radius * 0.55" fill="var(--bg-card, #fff)" />
          <text
            :x="cx"
            :y="cy - 4"
            text-anchor="middle"
            class="dii-pie-center-num"
          >{{ formatValue(totalValue) }}{{ valueSuffix }}</text>
          <text
            :x="cx"
            :y="cy + 14"
            text-anchor="middle"
            class="dii-pie-center-label"
          >{{ centerLabel || '合计' }}</text>
        </svg>
      </div>

      <!-- 图例：每项一行 -->
      <div class="dii-pie-legend">
        <div
          v-for="(slice, i) in slices"
          :key="i"
          class="dii-pie-legend-item"
        >
          <span class="dii-pie-legend-dot" :style="{ background: slice.color }"></span>
          <span class="dii-pie-legend-label">{{ slice.label }}</span>
          <span class="dii-pie-legend-value">{{ formatValue(slice.value) }}{{ valueSuffix }}</span>
          <span class="dii-pie-legend-pct">{{ slice.pct }}%</span>
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
  /** 中心区文字标签 */
  centerLabel: { type: String, default: '合计' },
  /** 数值后缀，如 ' min' / '%' */
  valueSuffix: { type: String, default: '' },
})

const cx = 100
const cy = 100
const radius = 80
const viewBox = `0 0 200 200`
const strokeColor = 'var(--bg-card, #fff)'

/** 调色板：7 种区分度高的颜色循环（足够 7 天 / 7 个领域不撞色） */
const SLICE_PALETTE = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ef4444', // red
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#ec4899', // pink
]

const hasData = computed(() => {
  if (!props.categories?.length || !props.series?.length) return false
  const vals = props.series[0]?.values || []
  return vals.some(v => Number(v) > 0)
})

const totalValue = computed(() => {
  const vals = props.series?.[0]?.values || []
  return vals.reduce((sum, v) => sum + (Number(v) || 0), 0)
})

/** 各切片的几何 + 元信息 */
const slices = computed(() => {
  const vals = props.series?.[0]?.values || []
  const cats = props.categories || []
  const total = totalValue.value
  if (!total) return []

  const out = []
  let startAngle = -Math.PI / 2  // 从 12 点钟方向起始

  for (let i = 0; i < cats.length; i++) {
    const v = Number(vals[i]) || 0
    if (v <= 0) continue
    const angle = (v / total) * Math.PI * 2
    const endAngle = startAngle + angle

    // SVG arc path
    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const largeArc = angle > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

    out.push({
      label: cats[i],
      value: v,
      pct: Math.round((v / total) * 100),
      color: SLICE_PALETTE[i % SLICE_PALETTE.length],
      d,
    })
    startAngle = endAngle
  }
  return out
})

function formatValue(v) {
  const n = Number(v) || 0
  if (Number.isInteger(n)) return n.toLocaleString('en-US')
  return n.toFixed(1)
}
</script>

<style scoped>
.dii-pie-wrap {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 0;
  min-height: 240px;
}
.dii-pie-empty {
  flex: 1;
  text-align: center;
  padding: 60px 0;
  color: var(--text-faint, #8990a0);
  font-size: 13px;
}

.dii-pie-svg-wrap {
  flex-shrink: 0;
  width: 220px;
}
.dii-pie-svg {
  width: 100%;
  height: auto;
  display: block;
}
.dii-pie-slice {
  transition: transform 0.15s ease;
  transform-origin: center;
  cursor: default;
}
.dii-pie-slice:hover {
  transform: scale(1.03);
}
.dii-pie-center-num {
  font-size: 18px;
  font-weight: 700;
  fill: var(--text-primary, #14171c);
  font-family: ui-monospace, monospace;
}
.dii-pie-center-label {
  font-size: 11px;
  fill: var(--text-secondary, #5a6172);
}

/* 图例区：自动撑满剩余空间 */
.dii-pie-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.dii-pie-legend-item {
  display: grid;
  grid-template-columns: 16px 1fr auto auto;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}
.dii-pie-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}
.dii-pie-legend-label {
  color: var(--text-primary, #14171c);
  font-family: ui-monospace, monospace;
}
.dii-pie-legend-value {
  color: var(--text-secondary, #5a6172);
  font-family: ui-monospace, monospace;
  white-space: nowrap;
}
.dii-pie-legend-pct {
  color: var(--text-faint, #8990a0);
  font-family: ui-monospace, monospace;
  width: 36px;
  text-align: right;
}

[data-theme="dark"] .dii-pie-center-num { fill: var(--text-primary, #e8edfb); }
[data-theme="dark"] .dii-pie-center-label { fill: var(--text-secondary, #9aa0aa); }
[data-theme="dark"] .dii-pie-legend-label { color: var(--text-primary, #e8edfb); }
</style>
