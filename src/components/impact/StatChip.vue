<template>
  <div class="isc" :style="{ background: color + '10', borderColor: color + '30', color }">
    <slot />
    <span class="isc-v">{{ value }}</span>
    <span class="isc-l">{{ label }}</span>
  </div>
</template>

<script setup>
defineProps({
  value: { type: Number, required: true },
  label: { type: String, required: true },
  color: { type: String, required: true },
})
</script>

<style scoped>
.isc {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.isc-v {
  font-size: 14px;
  font-weight: 700;
}
.isc-l {
  font-weight: 400;
  color: #8c8c8c;
  font-size: 11px;
}
</style>
