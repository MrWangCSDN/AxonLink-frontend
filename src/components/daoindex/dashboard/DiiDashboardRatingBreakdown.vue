<template>
  <section class="dii-panel">
    <div class="dii-panel__head">
      <div>
        <h3 class="dii-panel__title">评级分布</h3>
        <p class="dii-panel__desc">点击任一评级，直接进入对应 SQL 列表。</p>
      </div>
    </div>

    <div class="segmented-bar">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="segmented-bar__item"
        :class="`is-${item.key.toLowerCase()}`"
        :style="{ width: `${Math.max(item.ratio * 100, 10)}%` }"
        :title="`${item.label} ${item.count}`"
        @click="$emit('select', item.goto)"
      ></button>
    </div>

    <div class="rating-list">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="rating-row"
        @click="$emit('select', item.goto)"
      >
        <div class="rating-row__left">
          <span class="rating-row__dot" :class="`is-${item.key.toLowerCase()}`"></span>
          <span class="rating-row__label">{{ item.label }}</span>
        </div>
        <div class="rating-row__right">
          <span class="rating-row__count">{{ item.count }}</span>
          <span class="rating-row__ratio">{{ Math.round(item.ratio * 100) }}%</span>
        </div>
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

.segmented-bar {
  display: flex;
  height: 16px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-badge);
}

.segmented-bar__item {
  height: 100%;
}

.segmented-bar__item.is-poor { background: #f76707; }
.segmented-bar__item.is-good { background: #4f7cff; }
.segmented-bar__item.is-excellent { background: #12b886; }
.segmented-bar__item.is-not_applicable { background: #adb5bd; }

.rating-list {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.rating-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--bg-page);
  border: 1px solid var(--border-subtle);
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.rating-row:hover {
  transform: translateY(-1px);
  border-color: rgba(121,80,242,0.24);
}

.rating-row__left,
.rating-row__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rating-row__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.rating-row__dot.is-poor { background: #f76707; }
.rating-row__dot.is-good { background: #4f7cff; }
.rating-row__dot.is-excellent { background: #12b886; }
.rating-row__dot.is-not_applicable { background: #adb5bd; }

.rating-row__label,
.rating-row__count {
  color: var(--text-primary);
  font-size: 13px;
}

.rating-row__ratio {
  color: var(--text-faint);
  font-size: 12px;
}
</style>
