<template>
  <div class="iap-root">
    <transition name="iap-toast">
      <div
        v-if="notice"
        class="iap-toast"
        :class="`is-${notice.type || 'info'}`"
        role="status"
        aria-live="polite"
      >
        <div class="iap-toast-ico">
          <InfoCircleIcon v-if="notice.type === 'info'" class="iap-toast-svg" />
          <ErrorCircleIcon v-else class="iap-toast-svg" />
        </div>
        <div class="iap-toast-body">
          <div class="iap-toast-title">{{ notice.title }}</div>
          <div class="iap-toast-text">{{ notice.message }}</div>
        </div>
        <button
          type="button"
          class="iap-toast-close"
          aria-label="关闭提示"
          @click="$emit('dismissNotice')"
        >
          <CloseIcon class="iap-toast-close-ico" />
        </button>
      </div>
    </transition>

    <header class="iap-head">
      <div class="iap-accent" :style="{ background: `linear-gradient(180deg,${meta.color},${meta.color}80)` }" />
      <div class="iap-head-inner">
        <component :is="meta.icon" class="iap-ico" :style="{ color: meta.color }" />
        <span class="iap-title">{{ meta.pageTitle }}</span>
        <span class="iap-mode-badge" :style="modeBadgeStyle">
          <GitBranchIcon class="iap-git" />
          {{ meta.label }}
        </span>
        <template v-if="result">
          <ChevronRightIcon class="iap-chev" />
          <span class="iap-root-id" :style="{ color: rootColor }">{{ result.root.id }}</span>
        </template>
        <div class="iap-spacer" />
        <div class="iap-actions">
          <button
            type="button"
            class="iap-export-btn"
            :disabled="!canExportCurrent || exportCurrentLoading"
            @click="$emit('exportCurrent')"
          >
            <DownloadIcon class="iap-export-ico" />
            {{ exportCurrentLoading ? '导出中…' : '导出当前' }}
          </button>
          <button
            type="button"
            class="iap-export-btn iap-export-btn--primary"
            :disabled="!canExportAll || exportAllLoading"
            @click="$emit('exportAll')"
          >
            <DownloadIcon class="iap-export-ico" />
            {{ exportAllLoading ? '导出中…' : '导出全部' }}
          </button>
        </div>
        <TargetDropdown
          :items="allItems"
          :selected-id="selectedId"
          :meta="meta"
          @select="(id) => $emit('selectItem', id)"
        />
        <template v-if="result">
          <div class="iap-div" />
          <div class="iap-chips">
            <StatChip v-if="result.stats.components != null" :value="result.stats.components" label="构件" :color="LAYER_COLORS.component" />
            <StatChip v-if="result.stats.services != null" :value="result.stats.services" label="服务" :color="LAYER_COLORS.service" />
            <StatChip v-if="result.stats.orchestrations != null" :value="result.stats.orchestrations" label="编排" :color="LAYER_COLORS.orchestration" />
            <StatChip :value="result.stats.transactions" label="交易" :color="LAYER_COLORS.transaction" />
          </div>
        </template>
      </div>
    </header>

    <div class="iap-body">
      <div v-if="result" class="iap-banner" :style="bannerStyle">
        <div class="iap-banner-ico" :style="bannerIcoStyle">
          <DatabaseIcon v-if="result.root.nodeType === 'table'" class="iap-ban-svg" :style="{ color: rootColor }" />
          <CpuIcon v-else-if="result.root.nodeType === 'component'" class="iap-ban-svg" :style="{ color: rootColor }" />
          <SettingsIcon v-else class="iap-ban-svg" :style="{ color: rootColor }" />
        </div>
        <div class="iap-banner-mid">
          <div class="iap-banner-row">
            <span class="iap-ban-id">{{ result.root.id }}</span>
            <span v-if="result.root.domainId" class="iap-tag-dom" :style="tagDomStyle">{{ DOMAIN_NAMES[result.root.domainId] || result.root.domainId }}</span>
            <span class="iap-tag-layer" :style="tagLayerStyle">{{ LAYER_LABELS[result.root.nodeType] }}</span>
          </div>
          <div class="iap-ban-desc">
            {{ result.root.name }}
            <span v-if="result.root.desc" class="iap-dim"> · {{ result.root.desc }}</span>
          </div>
        </div>
      </div>

      <div class="iap-main" :class="{ 'iap-main--pad': !!result }">
        <ImpactFlowDiagram v-if="result" :result="result" />
        <ImpactEmptyState v-else :mode="mode" :meta="meta" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, h } from 'vue'
import ImpactFlowDiagram from './ImpactFlowDiagram.vue'
import ImpactEmptyState from './ImpactEmptyState.vue'
import TargetDropdown from './TargetDropdown.vue'
import StatChip from './StatChip.vue'
import { LAYER_COLORS, DOMAIN_COLORS } from './constants.js'

const props = defineProps({
  mode: { type: String, required: true },
  selectedId: { type: String, default: null },
  result: { type: Object, default: null },
  allItems: { type: Array, default: () => [] },
  canExportCurrent: { type: Boolean, default: false },
  canExportAll: { type: Boolean, default: false },
  exportCurrentLoading: { type: Boolean, default: false },
  exportAllLoading: { type: Boolean, default: false },
  notice: { type: Object, default: null },
})

defineEmits(['selectItem', 'exportCurrent', 'exportAll', 'dismissNotice'])

const LAYER_LABELS = {
  table: '数据层',
  component: '构件层',
  service: '服务层',
  orchestration: '流程编排',
  transaction: '联机交易',
}

const DOMAIN_NAMES = {
  common: '公共领域',
  loan: '贷款领域',
  deposit: '存款领域',
  settlement: '结算领域',
  public: '公共领域',
  ap: '平台',
  platform: '平台',
  dept: '机构领域',
  unvr: '通用领域',
  stmt: '账单领域',
  medu: '介质领域',
  inbu: '内部领域',
  aggr: '聚合领域',
}

function iconSvg(paths, size = 16) {
  return {
    name: 'IapIcon',
    props: { class: String, style: Object },
    setup(p) {
      return () => h('svg', { class: p.class, style: p.style, width: size, height: size, viewBox: '0 0 24 24', fill: 'none' }, paths.map((d) => h('path', d)))
    },
  }
}

const DatabaseIcon = iconSvg([
  { d: 'M12 3C7 3 4 4.5 4 6v12c0 1.5 3 3 8 3s8-1.5 8-3V6c0-1.5-3-3-8-3Z', stroke: 'currentColor', 'stroke-width': '1.5' },
  { d: 'M4 10c0 1.5 3 3 8 3s8-1.5 8-3M4 14c0 1.5 3 3 8 3s8-1.5 8-3', stroke: 'currentColor', 'stroke-width': '1.5' },
])
const CpuIcon = iconSvg([
  { d: 'M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' },
  { d: 'M9 9h6v6H9z', stroke: 'currentColor', 'stroke-width': '1.5' },
])
const SettingsIcon = iconSvg([
  { d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', stroke: 'currentColor', 'stroke-width': '1.5' },
  { d: 'M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c0 .69.4 1.32 1 1.55H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z', stroke: 'currentColor', 'stroke-width': '1.2' },
])
const GitBranchIcon = iconSvg([
  { d: 'M6 3v12M6 15a3 3 0 1 0 3 3M18 9a3 3 0 1 0-3-3M6 9h12', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' },
], 14)
const ChevronRightIcon = iconSvg([{ d: 'M9 6l6 6-6 6', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' }], 13)
const DownloadIcon = iconSvg([
  { d: 'M12 3v10', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' },
  { d: 'm8 10 4 4 4-4', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
  { d: 'M4 19h16', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' },
], 13)
const InfoCircleIcon = iconSvg([
  { d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', stroke: 'currentColor', 'stroke-width': '1.6' },
  { d: 'M12 10v5', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round' },
  { d: 'M12 7.5h.01', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round' },
], 15)
const ErrorCircleIcon = iconSvg([
  { d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', stroke: 'currentColor', 'stroke-width': '1.6' },
  { d: 'M12 7.5v6', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round' },
  { d: 'M12 16.7h.01', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round' },
], 15)
const CloseIcon = iconSvg([
  { d: 'M7 7l10 10M17 7 7 17', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round' },
], 12)

const MODE_META = {
  table: {
    label: '表级分析',
    pageTitle: '数据表影响溯源',
    placeholder: '搜索数据表…',
    color: '#13C2C2',
    bg: '#E6FFFB',
    border: '#87E8DE',
    icon: DatabaseIcon,
  },
  component: {
    label: '构件分析',
    pageTitle: '构件影响溯源',
    placeholder: '搜索构件…',
    color: '#FA8C16',
    bg: '#FFF7E6',
    border: '#FFD591',
    icon: CpuIcon,
  },
  service: {
    label: '服务分析',
    pageTitle: '服务影响溯源',
    placeholder: '搜索服务…',
    color: '#1890FF',
    bg: '#E6F7FF',
    border: '#91D5FF',
    icon: SettingsIcon,
  },
}

const meta = computed(() => MODE_META[props.mode] || MODE_META.table)

const rootColor = computed(() =>
  props.result ? LAYER_COLORS[props.result.root.nodeType] || '#8C8C8C' : '#8C8C8C',
)

const rootDomainColor = computed(() => {
  if (!props.result?.root.domainId) return '#8C8C8C'
  return DOMAIN_COLORS[props.result.root.domainId] || '#8C8C8C'
})

const modeBadgeStyle = computed(() => ({
  border: `1px solid ${meta.value.border}`,
  background: meta.value.bg,
  color: meta.value.color,
}))

const bannerStyle = computed(() => ({
  background: `linear-gradient(135deg,${rootColor.value}08 0%,${rootDomainColor.value}05 100%)`,
  border: `1px solid ${rootColor.value}20`,
  borderLeft: `4px solid ${rootColor.value}`,
}))

const bannerIcoStyle = computed(() => ({
  background: rootColor.value + '18',
  border: `1px solid ${rootColor.value}35`,
}))

const tagDomStyle = computed(() => ({
  color: rootDomainColor.value,
  background: rootDomainColor.value + '15',
  border: `1px solid ${rootDomainColor.value}35`,
}))

const tagLayerStyle = computed(() => ({
  color: rootColor.value,
  background: rootColor.value + '15',
  border: `1px solid ${rootColor.value}35`,
}))
</script>

<style scoped>
.iap-root {
  position: relative;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px);
  overflow: hidden;
}

.iap-toast {
  position: absolute;
  top: 16px;
  right: 24px;
  z-index: 20;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: min(420px, calc(100% - 48px));
  padding: 13px 14px 13px 12px;
  border-radius: 14px;
  border: 1px solid #d6e4ff;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(247,250,255,0.98) 100%);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(12px);
}

.iap-toast.is-info {
  border-color: #b7ebff;
  background:
    linear-gradient(135deg, rgba(230,247,255,0.98) 0%, rgba(246,252,255,0.98) 100%);
}

.iap-toast.is-error {
  border-color: #ffccc7;
  background:
    linear-gradient(135deg, rgba(255,241,240,0.98) 0%, rgba(255,250,250,0.98) 100%);
}

.iap-toast-ico {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.iap-toast.is-info .iap-toast-ico {
  color: #08979c;
  background: rgba(19, 194, 194, 0.12);
}

.iap-toast.is-error .iap-toast-ico {
  color: #cf1322;
  background: rgba(255, 77, 79, 0.12);
}

.iap-toast-svg {
  width: 15px;
  height: 15px;
  color: currentColor;
}

.iap-toast-body {
  min-width: 0;
  flex: 1;
}

.iap-toast-title {
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.3;
}

.iap-toast-text {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.45;
  color: #5b6476;
  word-break: break-word;
}

.iap-toast-close {
  width: 24px;
  height: 24px;
  margin-top: -1px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #8c94a6;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.iap-toast-close:hover {
  background: rgba(140, 148, 166, 0.12);
  color: #4b5563;
}

.iap-toast-close-ico {
  width: 12px;
  height: 12px;
  color: currentColor;
}

.iap-toast-enter-active,
.iap-toast-leave-active {
  transition: all 0.2s ease;
}

.iap-toast-enter-from,
.iap-toast-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.iap-head {
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  min-height: 54px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
}

[data-theme='dark'] .iap-head {
  background: var(--bg-sticky, #1e222a);
  border-color: var(--border, #333);
}

.iap-accent {
  width: 4px;
  flex-shrink: 0;
}

.iap-head-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  flex: 1;
  min-width: 0;
}

.iap-ico {
  flex-shrink: 0;
}

.iap-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  white-space: nowrap;
}

[data-theme='dark'] .iap-title {
  color: var(--text-primary, #e8e8e8);
}

.iap-mode-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.iap-git {
  width: 11px;
  height: 11px;
  color: currentColor;
}

.iap-chev {
  color: #d9d9d9;
  flex-shrink: 0;
}

.iap-root-id {
  font-size: 12px;
  font-family: ui-monospace, monospace;
  font-weight: 700;
}

.iap-spacer {
  flex: 1;
}

.iap-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.iap-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid #d9d9d9;
  background: #fff;
  color: #595959;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.iap-export-btn:hover:not(:disabled) {
  border-color: #91d5ff;
  background: #f7fbff;
  color: #1677ff;
}

.iap-export-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.iap-export-btn--primary {
  border-color: #91d5ff;
  background: #e6f4ff;
  color: #1677ff;
}

.iap-export-ico {
  width: 13px;
  height: 13px;
  color: currentColor;
}

.iap-div {
  width: 1px;
  height: 22px;
  background: #e8e8e8;
  flex-shrink: 0;
}

.iap-chips {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.iap-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.iap-banner {
  margin: 14px 24px 0;
  padding: 11px 18px;
  border-radius: 10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.iap-banner-ico {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.iap-ban-svg {
  width: 16px;
  height: 16px;
}

.iap-banner-mid {
  flex: 1;
  min-width: 0;
}

.iap-banner-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  flex-wrap: wrap;
}

.iap-ban-id {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
  font-family: ui-monospace, monospace;
}

[data-theme='dark'] .iap-ban-id {
  color: var(--text-primary);
}

.iap-tag-dom,
.iap-tag-layer {
  font-size: 10px;
  border-radius: 4px;
  padding: 1px 6px;
  font-weight: 500;
}

.iap-tag-layer {
  font-weight: 600;
}

.iap-ban-desc {
  font-size: 12px;
  color: #595959;
}

.iap-dim {
  color: #aaa;
}

.iap-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.iap-main--pad {
  padding: 12px 24px 20px;
}

[data-theme='dark'] .iap-export-btn {
  background: var(--bg-card, #20242c);
  border-color: var(--border, #3a404a);
  color: var(--text-secondary, #cfd6e4);
}

[data-theme='dark'] .iap-export-btn:hover:not(:disabled) {
  background: color-mix(in srgb, #1677ff 12%, var(--bg-card, #20242c));
  border-color: #3f8cff;
  color: #69b1ff;
}

[data-theme='dark'] .iap-export-btn--primary {
  background: color-mix(in srgb, #1677ff 16%, var(--bg-card, #20242c));
  border-color: #3f8cff;
  color: #69b1ff;
}

[data-theme='dark'] .iap-toast {
  border-color: rgba(145, 213, 255, 0.22);
  background:
    linear-gradient(135deg, rgba(30, 36, 46, 0.96) 0%, rgba(21, 27, 36, 0.96) 100%);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.34);
}

[data-theme='dark'] .iap-toast.is-info {
  border-color: rgba(19, 194, 194, 0.28);
  background:
    linear-gradient(135deg, rgba(14, 45, 54, 0.94) 0%, rgba(20, 29, 38, 0.96) 100%);
}

[data-theme='dark'] .iap-toast.is-error {
  border-color: rgba(255, 120, 117, 0.24);
  background:
    linear-gradient(135deg, rgba(66, 28, 31, 0.94) 0%, rgba(28, 24, 29, 0.96) 100%);
}

[data-theme='dark'] .iap-toast-title {
  color: var(--text-primary, #e8edf7);
}

[data-theme='dark'] .iap-toast-text {
  color: var(--text-secondary, #b8c2d6);
}

[data-theme='dark'] .iap-toast-close {
  color: #9aa4b7;
}

[data-theme='dark'] .iap-toast-close:hover {
  background: rgba(154, 164, 183, 0.14);
  color: #eef3ff;
}
</style>
