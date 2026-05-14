<template>
  <!--
    LLM 状态标签：NULL(待) / PENDING / DONE / FAILED / SKIPPED
    用在列表里，鼠标悬停时显示详细原因（llmError）
  -->
  <span
    class="dii-llm-tag"
    :class="`is-${meta.role}`"
    :title="tooltip"
  >
    <component
      v-if="iconComp"
      :is="iconComp"
      :size="12"
      :stroke-width="2"
      class="dii-llm-ico"
      :class="{ 'is-spin': meta.iconKind === 'loader' }"
    />
    <span class="dii-llm-lbl">{{ meta.label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { Loader2, Check, X, Minus } from 'lucide-vue-next'
import { LLM_STATUS_META } from '../constants.js'

const props = defineProps({
  status: { type: String, default: null },
  llmError: { type: String, default: '' },
  pending: { type: [Boolean, Number], default: false },
})

const meta = computed(() => {
  // llm_status=null 但 llm_pending=1 → 显示待分析
  if (!props.status && toBool(props.pending)) return LLM_STATUS_META.PENDING
  const key = (props.status || '').toUpperCase()
  if (LLM_STATUS_META[key]) return LLM_STATUS_META[key]
  // 真 · 完全未触发
  return { label: '未触发', role: 'faint', iconKind: 'minus' }
})

/** iconKind → Lucide 组件 */
const ICON_MAP = { loader: Loader2, check: Check, x: X, minus: Minus }
const iconComp = computed(() => ICON_MAP[meta.value.iconKind] || null)

const tooltip = computed(() => {
  const base = meta.value.label
  if (props.llmError) return `${base}：${props.llmError}`
  return base
})

function toBool(v) {
  if (typeof v === 'number') return v === 1
  return !!v
}
</script>

<style scoped>
.dii-llm-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11.5px;
  line-height: 1.4;
  border: 1px solid transparent;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.dii-llm-ico {
  flex-shrink: 0;
}
.dii-llm-ico.is-spin {
  animation: dii-llm-spin 0.9s linear infinite;
}
@keyframes dii-llm-spin { to { transform: rotate(360deg); } }

.is-running {
  background: var(--build-sync-running-bg);
  color: var(--build-sync-running-color);
  border-color: var(--build-sync-running-border);
}

.is-success {
  background: var(--build-sync-success-bg);
  color: var(--build-sync-success-color);
  border-color: var(--build-sync-success-border);
}

.is-error {
  background: var(--build-sync-error-bg);
  color: var(--build-sync-error-color);
  border-color: var(--build-sync-error-border);
}

.is-faint,
.is-idle {
  background: var(--bg-badge);
  color: var(--text-faint);
  border-color: var(--border-subtle);
}
</style>
