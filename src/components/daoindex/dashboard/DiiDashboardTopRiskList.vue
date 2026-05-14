<template>
  <section class="dii-panel">
    <div class="dii-panel__head">
      <div>
        <h3 class="dii-panel__title">最差 TOP 表</h3>
        <p class="dii-panel__desc">按高风险 SQL 数排序，优先处理最热问题表。</p>
      </div>
    </div>

    <div class="risk-list">
      <button
        v-for="(item, idx) in items"
        :key="item.tableName"
        type="button"
        class="risk-row"
        @click="$emit('select', item.goto)"
      >
        <div class="risk-row__rank">{{ idx + 1 }}</div>
        <div class="risk-row__body">
          <div class="risk-row__name">{{ item.tableName }}</div>
          <div class="risk-row__meta">{{ item.changeText }}</div>
        </div>
        <div class="risk-row__count">{{ item.poorCount }}</div>
      </button>
    </div>
  </section>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
})

defineEmits(['select'])
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

.risk-list {
  display: grid;
  gap: 10px;
}

.risk-row {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--bg-page);
  border: 1px solid var(--border-subtle);
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.risk-row:hover {
  transform: translateY(-1px);
  border-color: rgba(121,80,242,0.24);
}

.risk-row__rank {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(121,80,242,0.12);
  color: #6d4ce6;
  font-weight: 700;
}

.risk-row__body {
  min-width: 0;
}

.risk-row__name {
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.risk-row__meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-faint);
}

.risk-row__count {
  min-width: 54px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(247,103,7,0.12);
  color: #d9480f;
  font-weight: 600;
  text-align: center;
}
</style>
