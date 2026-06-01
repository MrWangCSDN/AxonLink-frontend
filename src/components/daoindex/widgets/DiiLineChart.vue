<template>
  <!--
    纯 SVG 折线图（用于"7 天趋势"等"按时间序列展示多系列变化"场景）

    数据契约（与 DiiBarGroupChart / DiiHorizontalStackBar 完全一致，便于互换）：
      categories: ['05-07', '05-08', ...]    横轴分类
      series: [
        { name: '优', color: '#xxx', values: [1355, 1458, ...], dash: '10 6' },
        ...
      ]
      values 长度必须 = categories 长度，否则按 categories 截断/补 0。
      dash 可选：SVG stroke-dasharray 字符串（如 '10 6'）；不传 = 实线。

    渲染规则：
      - 多系列同图，每个 series 一条折线 + 圆点
      - Y 轴 4 档刻度（0 / max*0.33 / max*0.66 / max）
      - 圆点 hover 显示 tooltip
      - 0 值仍然显示圆点，仅高度为 0
      - 单点 series（categories 只有 1 项）退化成单个圆点
  -->
  <div class="dii-line-wrap">
    <div v-if="!hasData" class="dii-line-empty">暂无数据</div>
    <template v-else>
      <!-- Y 轴刻度 -->
      <div class="dii-line-yaxis">
        <span
          v-for="(label, i) in yAxisLabels"
          :key="i"
          class="dii-line-ylabel"
          :style="{ top: yAxisPositions[i] + '%' }"
        >{{ label }}</span>
      </div>

      <!-- 图表主区（SVG 折线 + 横轴标签） -->
      <div class="dii-line-main">
        <svg
          class="dii-line-svg"
          :viewBox="`0 0 ${width} ${height}`"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- 网格横线（4 条，对应 4 档 Y 刻度） -->
          <g class="dii-line-grid">
            <line
              v-for="i in 4"
              :key="i"
              :x1="0"
              :y1="((i - 1) / 3) * height"
              :x2="width"
              :y2="((i - 1) / 3) * height"
              stroke="var(--border-subtle, #ebeef2)"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />
          </g>

          <!-- 每个 series 一条折线 -->
          <g v-for="(s, si) in series" :key="si">
            <polyline
              :points="polylinePoints(s)"
              fill="none"
              :stroke="s.color"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              :stroke-dasharray="s.dash || undefined"
              vector-effect="non-scaling-stroke"
            />
            <!-- 数据点（圆 + 鼠标悬停 title） -->
            <circle
              v-for="(_, ci) in categories"
              :key="ci"
              :cx="xCoord(ci)"
              :cy="yCoord(s.values?.[ci] || 0)"
              r="4"
              :fill="s.color"
              stroke="#fff"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            >
              <title>{{ s.name }}: {{ tooltipValue(s, ci) }}（{{ categories[ci] }}）</title>
            </circle>
          </g>
        </svg>

        <!-- 横轴 category 标签 -->
        <div class="dii-line-xaxis">
          <span
            v-for="(cat, ci) in categories"
            :key="ci"
            class="dii-line-xlabel"
          >{{ cat }}</span>
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
  /** SVG viewBox 高度（实际高度自适应容器，viewBox 比例决定形状） */
  height: { type: Number, default: 220 },
  /** SVG viewBox 宽度（不会真正渲染成这么宽，只决定坐标系） */
  width: { type: Number, default: 600 },
})

const hasData = computed(() => {
  if (!props.categories?.length || !props.series?.length) return false
  return props.series.some(s =>
    Array.isArray(s?.values) && s.values.some(v => Number(v) > 0)
  )
})

const maxValue = computed(() => {
  let m = 0
  for (const s of props.series || []) {
    for (const v of (s?.displayValues || s?.values || [])) {
      const n = Number(v) || 0
      if (n > m) m = n
    }
  }
  return Math.max(m * 1.1, 1)
})

/** Y 轴 4 档刻度（从大到小） */
const yAxisLabels = computed(() => {
  const max = maxValue.value
  return [max, max * 2 / 3, max / 3, 0].map(v => formatValue(v))
})

/** 4 档刻度对应的 top 百分比（0% 在顶部，100% 在底部） */
const yAxisPositions = computed(() => [0, 33.3, 66.6, 100])

/** 给定 category index → SVG x 坐标 */
function xCoord(ci) {
  if (props.categories.length <= 1) return props.width / 2
  return (ci / (props.categories.length - 1)) * props.width
}

/** 给定数值 → SVG y 坐标（值越大 y 越小，因为 svg 0 在顶部） */
function yCoord(v) {
  const n = Number(v) || 0
  const ratio = n / maxValue.value
  return props.height - (ratio * props.height)
}

/** 一个 series 的 polyline points 字符串（用 displayValues 优先） */
function polylinePoints(s) {
  const vals = s?.displayValues || s?.values || []
  return props.categories
    .map((_, ci) => `${xCoord(ci)},${yCoord(vals[ci] || 0)}`)
    .join(' ')
}

function formatValue(v) {
  const n = Number(v) || 0
  if (Number.isInteger(n)) return n.toLocaleString('en-US')
  return n.toFixed(1)
}

function tooltipValue(s, ci) {
  const vals = s?.displayValues || s?.values || []
  return formatValue(vals[ci] || 0)
}
</script>

<style scoped>
.dii-line-wrap {
  display: flex;
  align-items: stretch;
  min-height: 280px;
  padding: 12px 0 0;
  position: relative;
}
.dii-line-empty {
  flex: 1;
  text-align: center;
  padding: 60px 0;
  color: var(--text-faint, #8990a0);
  font-size: 13px;
}

/* Y 轴刻度文字 */
.dii-line-yaxis {
  width: 56px;
  flex-shrink: 0;
  position: relative;
  height: v-bind('height + "px"');
}
.dii-line-ylabel {
  position: absolute;
  right: 6px;
  transform: translateY(-50%);
  font-size: 11px;
  color: var(--text-faint, #8990a0);
  font-family: ui-monospace, monospace;
  white-space: nowrap;
}

/* 主图区 */
.dii-line-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;  /* 允许 svg 缩小 */
}
.dii-line-svg {
  width: 100%;
  height: v-bind('height + "px"');
  display: block;
  border-left: 1px solid var(--border-subtle, #ebeef2);
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
  overflow: visible;  /* 允许圆点轻微超出边界 */
}

/* 横轴标签 */
.dii-line-xaxis {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  padding: 0 4px;
}
.dii-line-xlabel {
  font-size: 12px;
  color: var(--text-secondary, #5a6172);
  font-family: ui-monospace, monospace;
  white-space: nowrap;
}

[data-theme="dark"] .dii-line-svg {
  border-left-color: rgba(255, 255, 255, 0.08);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}
</style>
