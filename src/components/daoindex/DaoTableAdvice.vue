<template>
  <div class="dii-page">
    <div class="dii-sticky">
      <div class="dii-breadcrumb">
        <span class="dii-bc-home">SQL 巡检</span>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M5 3.5L8.5 7L5 10.5" stroke="#C5CBD7" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="dii-bc-current">表维度建议</span>
      </div>
      <div class="dii-header">
        <h2 class="dii-title">表维度建议聚合</h2>
        <div class="dii-header-right">
          <DiiEnvSwitcher :model-value="env" @update:model-value="$emit('update:env', $event)" />
        </div>
      </div>
    </div>

    <div class="dii-scroll">
      <DiiEmptyState
        title="表维度聚合视图待开发"
        desc="接入 /debug/table-advice-rollup，按表展示被多条 SQL 推荐的 DDL 建议清单"
      />
    </div>
  </div>
</template>

<script setup>
import DiiEnvSwitcher from './widgets/DiiEnvSwitcher.vue'
import DiiEmptyState from './widgets/DiiEmptyState.vue'

defineProps({ env: { type: String, default: 'uat' } })
defineEmits(['update:env', 'open-detail'])
</script>

<style scoped>
.dii-page { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.dii-sticky { flex-shrink: 0; padding: 18px 24px 14px; background: var(--bg-sticky); border-bottom: 1px solid var(--border-subtle); }
.dii-breadcrumb { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; }
.dii-bc-home { font-size: 12.5px; color: var(--text-faint); }
.dii-bc-current { font-size: 12.5px; color: var(--text-primary); font-weight: 500; }
.dii-header { display: flex; justify-content: space-between; align-items: center; }
.dii-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0; }
.dii-scroll { flex: 1; overflow-y: auto; padding: 24px; }
</style>
