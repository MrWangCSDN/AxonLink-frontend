<template>
  <!--
    JSON 树形展示（递归组件）。
    用于 EXPLAIN plan / table_ratings_json 等长 JSON 的可读展示。
  -->
  <div class="dii-json-tree">
    <DiiJsonNode :data="parsed" name="root" :depth="0" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DiiJsonNode from './DiiJsonNode.vue'
import { safeParse } from '../../../utils/daoIndex.js'

const props = defineProps({
  value: { type: [Object, Array, String, Number, Boolean], default: null },
})

// 支持传字符串 JSON（常见：后端直接吐 TEXT 字段）
const parsed = computed(() => {
  if (typeof props.value === 'string') return safeParse(props.value, props.value)
  return props.value
})
</script>

<style scoped>
.dii-json-tree {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
  color: var(--code-text);
  background: var(--code-body-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  max-height: 420px;
  overflow: auto;
}
</style>
