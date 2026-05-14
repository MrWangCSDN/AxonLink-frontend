<template>
  <section class="dii-panel">
    <div class="dii-panel__head">
      <div>
        <h3 class="dii-panel__title">待关注事项</h3>
        <p class="dii-panel__desc">优先清理会影响评级可信度和处理效率的问题。</p>
      </div>
    </div>

    <div class="attention-list">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="attention-row"
        @click="$emit('select', item.goto)"
      >
        <div class="attention-row__top">
          <span class="attention-row__label">{{ item.label }}</span>
          <span class="attention-row__count">{{ item.count }}</span>
        </div>
        <p class="attention-row__desc">{{ item.desc }}</p>
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

.attention-list {
  display: grid;
  gap: 10px;
}

.attention-row {
  padding: 14px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(121,80,242,0.06), rgba(121,80,242,0.02));
  border: 1px solid rgba(121,80,242,0.12);
  transition: transform 0.15s ease, border-color 0.15s ease;
  text-align: left;
}

.attention-row:hover {
  transform: translateY(-1px);
  border-color: rgba(121,80,242,0.26);
}

.attention-row__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.attention-row__label {
  color: var(--text-primary);
  font-weight: 600;
}

.attention-row__count {
  min-width: 38px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(121,80,242,0.12);
  color: #6d4ce6;
  text-align: center;
  font-weight: 700;
}

.attention-row__desc {
  margin-top: 10px;
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.65;
}
</style>
