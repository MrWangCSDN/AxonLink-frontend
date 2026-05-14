<template>
  <!-- 通用空状态/错误状态 -->
  <div class="dii-empty" :class="{ 'is-error': variant === 'error' }">
    <svg
      v-if="variant === 'error'"
      width="48" height="48" viewBox="0 0 48 48" fill="none"
    >
      <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5"/>
      <path d="M24 14v12M24 30v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <svg v-else width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.5"/>
      <path d="M16 24h16M24 16v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <p class="dii-empty-title">{{ title }}</p>
    <p v-if="desc" class="dii-empty-desc">{{ desc }}</p>
    <slot></slot>
  </div>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'empty' }, // 'empty' | 'error'
  title: { type: String, default: '暂无数据' },
  desc: { type: String, default: '' },
})
</script>

<style scoped>
.dii-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 24px;
  color: var(--text-faint);
  text-align: center;
}

.dii-empty.is-error {
  color: var(--build-sync-error-color);
}

.dii-empty-title {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-top: 4px;
}

.dii-empty-desc {
  font-size: 12.5px;
  color: var(--text-faint);
  max-width: 320px;
  line-height: 1.6;
}
</style>
