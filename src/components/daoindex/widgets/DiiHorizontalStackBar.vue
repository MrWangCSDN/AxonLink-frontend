<template>
  <!--
    横向堆叠条图（用于"评级分布"等"分类内占比"场景）：
    每个 row（=领域）一条横向 bar，bar 内按 series 顺序堆叠不同颜色段
    每段宽度 = (该 series 该 row 的值) / (该 row 总和)，确保所有段加起来 = 100%
    段内自带数字 + 悬停 tooltip

    数据契约（与 DiiBarGroupChart 相同，便于互换）：
      categories: ['存款', '贷款', ...]
      series: [
        { name: '优', color: '#xxx', values: [717, 478, ...] },
        { name: '良', color: '#xxx', values: [243, 162, ...] },
        ...
      ]
  -->
  <div class="dii-stack">
    <div v-if="!hasData" class="dii-stack-empty">暂无数据</div>
    <template v-else>
      <div
        v-for="(cat, ci) in categories"
        :key="ci"
        class="dii-stack-row"
      >
        <div class="dii-stack-row-head">
          <span class="dii-stack-row-label">{{ cat }}</span>
          <span class="dii-stack-row-total">{{ formatValue(rowTotal(ci)) }}</span>
        </div>
        <div class="dii-stack-bar">
          <div
            v-for="(s, si) in series"
            :key="si"
            v-show="(s.values?.[ci] || 0) > 0"
            class="dii-stack-seg"
            :style="{
              width: segWidth(ci, si),
              background: s.color,
            }"
            :title="`${s.name}: ${formatValue(s.values?.[ci] || 0)}（${ratio(ci, si)}%）`"
          >
            <!-- 段宽度足够 (>=10%) 时显示数字 + 名字；否则只能 hover tooltip -->
            <span v-if="ratio(ci, si) >= 10" class="dii-stack-seg-text">
              {{ s.name }} {{ formatValue(s.values[ci]) }}
            </span>
            <span v-else-if="ratio(ci, si) >= 4" class="dii-stack-seg-text-min">
              {{ formatValue(s.values[ci]) }}
            </span>
          </div>
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
})

const hasData = computed(() => {
  if (!props.categories?.length || !props.series?.length) return false
  return props.series.some(s =>
    Array.isArray(s?.values) && s.values.some(v => Number(v) > 0)
  )
})

/** 某 row（cat）的所有 series 求和 */
function rowTotal(ci) {
  let sum = 0
  for (const s of props.series || []) {
    sum += Number(s?.values?.[ci]) || 0
  }
  return sum
}

/** 某 row 内某 series 的占比（百分比，整数） */
function ratio(ci, si) {
  const total = rowTotal(ci)
  if (!total) return 0
  const v = Number(props.series[si]?.values?.[ci]) || 0
  return Math.round((v / total) * 100)
}

function segWidth(ci, si) {
  return `${ratio(ci, si)}%`
}

function formatValue(v) {
  return Number(v || 0).toLocaleString('en-US')
}
</script>

<style scoped>
.dii-stack {
  padding: 8px 0;
}
.dii-stack-empty {
  text-align: center;
  padding: 60px 0;
  color: var(--text-faint, #8990a0);
  font-size: 13px;
}

.dii-stack-row {
  margin-bottom: 14px;
}
.dii-stack-row:last-child {
  margin-bottom: 0;
}
.dii-stack-row-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}
.dii-stack-row-label {
  font-size: 13px;
  color: var(--text-primary, #14171c);
  font-weight: 500;
}
.dii-stack-row-total {
  font-size: 12px;
  color: var(--text-secondary, #5a6172);
  font-family: ui-monospace, monospace;
}

.dii-stack-bar {
  display: flex;
  height: 26px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--border-subtle, #ebeef2);
}
.dii-stack-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease;
  overflow: hidden;
  cursor: default;
}
.dii-stack-seg:hover {
  opacity: 0.85;
}
.dii-stack-seg-text {
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  padding: 0 4px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}
.dii-stack-seg-text-min {
  color: #fff;
  font-size: 10px;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}

[data-theme="dark"] .dii-stack-bar {
  background: rgba(255, 255, 255, 0.08);
}
</style>
