<template>
  <button type="button" class="kpi-card" :class="toneClass" @click="$emit('select', item.goto)">
    <div class="kpi-card__head">
      <span class="kpi-card__label">{{ item.label }}</span>
      <span class="kpi-card__hint">查看详情</span>
    </div>
    <div class="kpi-card__value">{{ item.value }}</div>
    <div class="kpi-card__meta">{{ item.deltaText || '—' }}</div>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  item: { type: Object, required: true },
})

defineEmits(['select'])

const toneClass = computed(() => `is-${props.item.statusTone || 'neutral'}`)
</script>

<style scoped>
.kpi-card {
  width: 100%;
  padding: 18px 18px 16px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background:
    radial-gradient(circle at top right, rgba(121,80,242,0.10), transparent 42%),
    linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.9));
  text-align: left;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  box-shadow: 0 10px 26px rgba(31, 41, 55, 0.06);
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(31, 41, 55, 0.1);
  border-color: rgba(121,80,242,0.24);
}

.kpi-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.kpi-card__label {
  font-size: 12px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.kpi-card__hint {
  font-size: 11px;
  color: var(--text-faint);
}

.kpi-card__value {
  margin-top: 16px;
  font-size: 34px;
  line-height: 1;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.kpi-card__meta {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.kpi-card.is-success .kpi-card__value,
.kpi-card.is-success .kpi-card__meta {
  color: var(--build-sync-success-color);
}

.kpi-card.is-warning .kpi-card__value,
.kpi-card.is-warning .kpi-card__meta {
  color: #d97706;
}

.kpi-card.is-danger .kpi-card__value,
.kpi-card.is-danger .kpi-card__meta {
  color: var(--build-sync-error-color);
}

[data-theme="dark"] .kpi-card {
  background:
    radial-gradient(circle at top right, rgba(121,80,242,0.18), transparent 42%),
    linear-gradient(180deg, rgba(26,37,64,0.98), rgba(26,37,64,0.92));
  box-shadow: 0 18px 36px rgba(3, 8, 20, 0.2);
}
</style>
