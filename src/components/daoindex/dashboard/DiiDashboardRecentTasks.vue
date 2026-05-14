<template>
  <section class="dii-panel">
    <div class="dii-panel__head">
      <div>
        <h3 class="dii-panel__title">最近任务</h3>
        <p class="dii-panel__desc">优先看最新批次的状态和处理进度。</p>
      </div>
    </div>

    <div class="task-list">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="task-row"
        @click="$emit('select', item.goto)"
      >
        <div class="task-row__top">
          <span class="task-row__label">{{ item.label }}</span>
          <span class="task-row__status" :class="statusClass(item.statusText)">{{ item.statusText }}</span>
        </div>
        <div class="task-row__meta">
          <span>{{ item.progressText }}</span>
          <span>{{ item.durationText }}</span>
        </div>
        <div class="task-row__id">{{ item.id }}</div>
      </button>
    </div>
  </section>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
})

defineEmits(['select'])

function statusClass(statusText = '') {
  if (statusText.includes('失败')) return 'is-error'
  if (statusText.includes('运行')) return 'is-running'
  return 'is-success'
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

.task-list {
  display: grid;
  gap: 10px;
}

.task-row {
  padding: 14px;
  border-radius: 16px;
  background: var(--bg-page);
  border: 1px solid var(--border-subtle);
  transition: transform 0.15s ease, border-color 0.15s ease;
  text-align: left;
}

.task-row:hover {
  transform: translateY(-1px);
  border-color: rgba(121,80,242,0.24);
}

.task-row__top,
.task-row__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.task-row__label {
  color: var(--text-primary);
  font-weight: 600;
}

.task-row__status {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid transparent;
}

.task-row__status.is-success {
  background: var(--build-sync-success-bg);
  color: var(--build-sync-success-color);
}

.task-row__status.is-running {
  background: var(--build-sync-running-bg);
  color: var(--build-sync-running-color);
}

.task-row__status.is-error {
  background: var(--build-sync-error-bg);
  color: var(--build-sync-error-color);
}

.task-row__meta {
  margin-top: 10px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.task-row__id {
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
</style>
