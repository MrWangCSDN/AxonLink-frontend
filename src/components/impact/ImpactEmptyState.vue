<template>
  <div class="ies">
    <div class="ies-ico" :style="icoWrap">
      <component :is="meta.icon" class="ies-big" :style="{ color: meta.color }" />
    </div>
    <h3 class="ies-h">{{ meta.pageTitle }}</h3>
    <p class="ies-p">点击右上角下拉框选择分析目标，系统将自动计算并展示完整影响链路</p>

    <div class="ies-flow">
      <template v-for="(step, i) in steps" :key="i">
        <div v-if="i > 0" class="ies-between">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path
              d="M2,8 H12 M8,3 L12,8 L8,13"
              fill="none"
              stroke="#D9D9D9"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="ies-step" :style="{ background: i === 0 ? colors[step.nodeType] + '07' : 'white' }">
          <span v-if="i === 0" class="ies-target" :style="targetTagStyle">目标</span>
          <div class="ies-node" :style="nodeBox(step.nodeType, i === 0)">
            <span class="ies-emoji">{{ NODE_ICON[step.nodeType] }}</span>
          </div>
          <div class="ies-step-txt">
            <div class="ies-lbl" :style="{ color: colors[step.nodeType] }">{{ step.label }}</div>
            <div class="ies-sub">{{ step.sub }}</div>
          </div>
        </div>
      </template>
    </div>

    <div class="ies-hint">
      <span class="ies-arrow">↗</span>
      点击右上角「选择{{ meta.label.replace('分析', '') }}…」下拉框开始溯源
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { LAYER_COLORS } from './constants.js'

const FLOW_STEPS = {
  table: [
    { nodeType: 'table', label: '数据层', sub: '目标数据表' },
    { nodeType: 'component', label: '构件层', sub: '读写该表的构件' },
    { nodeType: 'service', label: '服务层', sub: '调用构件的服务' },
    { nodeType: 'transaction', label: '联机交易', sub: '最终联机交易' },
  ],
  component: [
    { nodeType: 'component', label: '构件层', sub: '目标构件' },
    { nodeType: 'service', label: '服务层', sub: '编排该构件的服务' },
    { nodeType: 'transaction', label: '联机交易', sub: '最终联机交易' },
  ],
  service: [
    { nodeType: 'service', label: '服务层', sub: '目标服务' },
    { nodeType: 'orchestration', label: '流程编排', sub: '直接 flow step' },
    { nodeType: 'transaction', label: '联机交易', sub: '调用该服务的交易' },
  ],
}

const NODE_ICON = {
  table: '\uD83D\uDDC3\uFE0F',
  component: '\uD83E\uDDE9',
  service: '\u2699\uFE0F',
  orchestration: '\uD83D\uDD00',
  transaction: '\uD83D\uDCB3',
}

const props = defineProps({
  mode: { type: String, required: true },
  meta: { type: Object, required: true },
})

const colors = LAYER_COLORS

const steps = computed(() => FLOW_STEPS[props.mode] || FLOW_STEPS.table)

const targetTagStyle = computed(() => ({
  color: props.meta.color,
  background: props.meta.color + '18',
}))

const icoWrap = computed(() => ({
  background: `linear-gradient(135deg,${props.meta.color}1E,${props.meta.color}38)`,
  border: `2px solid ${props.meta.color}45`,
  boxShadow: `0 8px 28px ${props.meta.color}22`,
}))

function nodeBox(nodeType, first) {
  const c = colors[nodeType]
  return {
    background: c + (first ? '22' : '10'),
    border: `2px solid ${c}${first ? '55' : '28'}`,
  }
}
</script>

<style scoped>
.ies {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 40px;
  background: radial-gradient(ellipse at 50% 40%, rgba(24, 144, 255, 0.04) 0%, transparent 60%);
}

.ies-ico {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ies-big {
  width: 32px;
  height: 32px;
}

.ies-h {
  font-size: 18px;
  font-weight: 600;
  color: #262626;
  margin: 0 0 8px;
  text-align: center;
}

[data-theme='dark'] .ies-h {
  color: var(--text-primary);
}

.ies-p {
  font-size: 13px;
  color: #8c8c8c;
  margin: 0 0 36px;
  text-align: center;
  max-width: 440px;
  line-height: 1.7;
}

.ies-flow {
  display: flex;
  align-items: stretch;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #ebebeb;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  margin-bottom: 28px;
  overflow: hidden;
}

[data-theme='dark'] .ies-flow {
  background: var(--bg-card);
  border-color: var(--border);
}

.ies-between {
  display: flex;
  align-items: center;
  padding: 0 4px;
  background: #f9f9f9;
  border-left: 1px solid #f0f0f0;
  border-right: 1px solid #f0f0f0;
}

.ies-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 24px;
  gap: 8px;
  position: relative;
  min-width: 100px;
}

.ies-target {
  position: absolute;
  top: 7px;
  right: 7px;
  font-size: 9px;
  border-radius: 8px;
  padding: 1px 5px;
  font-weight: 700;
}

.ies-node {
  width: 48px;
  height: 48px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.ies-step-txt {
  text-align: center;
}

.ies-lbl {
  font-size: 12px;
  font-weight: 700;
}

.ies-sub {
  font-size: 10px;
  color: #bfbfbf;
  margin-top: 2px;
}

.ies-hint {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: #bfbfbf;
  padding: 6px 16px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px dashed #e0e0e0;
  border-radius: 20px;
}

.ies-arrow {
  font-size: 14px;
}
</style>
