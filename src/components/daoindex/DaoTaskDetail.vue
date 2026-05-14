<template>
  <div class="dii-detail-overlay">
    <div class="dii-detail-topbar">
      <button class="dii-back" @click="$emit('close')">← 返回任务列表</button>
      <div class="dii-detail-title-group">
        <span class="dii-detail-id">任务 #{{ taskId }}</span>
      </div>
    </div>
    <div class="dii-detail-scroll">
      <DiiEmptyState title="任务详情待开发" desc="后续会展示进度条 / 成功失败计数 / 该任务下的 SQL 列表" />
    </div>
  </div>
</template>

<script setup>
import DiiEmptyState from './widgets/DiiEmptyState.vue'

defineProps({ taskId: { type: [Number, String], required: true } })
defineEmits(['close', 'open-sql'])
</script>

<style scoped>
.dii-detail-overlay { position: absolute; inset: 0; background: var(--bg-page); z-index: 20; display: flex; flex-direction: column; overflow: hidden; }
.dii-detail-topbar { display: flex; gap: 16px; padding: 14px 24px; background: var(--bg-card); border-bottom: 1px solid var(--border-subtle); align-items: center; }
.dii-back { padding: 6px 10px; background: transparent; border: 1px solid var(--border); border-radius: 6px; color: var(--text-secondary); font-size: 12.5px; cursor: pointer; }
.dii-back:hover { background: var(--bg-domain-hover); }
.dii-detail-id { font-size: 14px; color: var(--text-primary); font-weight: 600; font-family: ui-monospace, monospace; }
.dii-detail-scroll { flex: 1; overflow-y: auto; padding: 20px 24px 40px; }
</style>
