<template>
  <!--
    评级徽章：差/良/优/不适用 的统一展示组件。
    rating: 'POOR' | 'GOOD' | 'EXCELLENT' | 'NOT_APPLICABLE' | null
    size:   'sm' | 'md'
    dense:  true = 紧凑（仅色块 + 缩写）
  -->
  <span
    class="dii-rating-badge"
    :class="[`is-${meta.role}`, `size-${size}`, { dense }]"
    :title="tooltip || meta.label"
  >
    <span class="dii-rating-dot">{{ meta.icon }}</span>
    <span v-if="!dense" class="dii-rating-label">{{ meta.label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { RATING_META } from '../constants.js'

const props = defineProps({
  rating: { type: String, default: null },
  size: { type: String, default: 'md' },
  dense: { type: Boolean, default: false },
  tooltip: { type: String, default: '' },
})

const meta = computed(() => {
  const key = (props.rating || 'NOT_APPLICABLE').toUpperCase()
  return RATING_META[key] || RATING_META.NOT_APPLICABLE
})
</script>

<style scoped>
.dii-rating-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  border: 1px solid transparent;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.dii-rating-badge.size-sm {
  font-size: 11px;
  padding: 1px 6px;
}

.dii-rating-badge.dense {
  padding: 2px 6px;
}

.dii-rating-dot {
  font-size: 8px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
}

/* ── 语义色：直接引用 style.css 里的 build-sync-* 变量 ── */
.is-error {
  background: var(--build-sync-error-bg);
  color: var(--build-sync-error-color);
  border-color: var(--build-sync-error-border);
}

.is-success {
  background: var(--build-sync-success-bg);
  color: var(--build-sync-success-color);
  border-color: var(--build-sync-success-border);
}

.is-running {
  background: var(--build-sync-running-bg);
  color: var(--build-sync-running-color);
  border-color: var(--build-sync-running-border);
}

.is-idle {
  background: var(--build-sync-idle-bg);
  color: var(--build-sync-idle-color);
  border-color: var(--build-sync-idle-border);
}

.is-faint {
  background: var(--bg-badge);
  color: var(--text-faint);
  border-color: var(--border-subtle);
}
</style>
