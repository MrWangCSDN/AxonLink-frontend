<template>
  <!--
    JSON 递归节点：
    - 对象/数组：显示 key 名 + 折叠按钮 + 子节点
    - 基础类型：显示 key = value
  -->
  <div class="dii-json-node" :style="{ paddingLeft: depth === 0 ? 0 : '16px' }">
    <template v-if="isComposite">
      <span class="dii-json-toggle" @click="open = !open">{{ open ? '▾' : '▸' }}</span>
      <span v-if="name !== 'root'" class="dii-json-key">{{ name }}:</span>
      <span class="dii-json-type">{{ typeHint }}</span>
      <span v-if="!open" class="dii-json-summary">{{ summary }}</span>
      <div v-if="open" class="dii-json-children">
        <DiiJsonNode
          v-for="(item, key) in entries"
          :key="key"
          :name="String(key)"
          :data="item"
          :depth="depth + 1"
        />
      </div>
    </template>
    <template v-else>
      <span v-if="name !== 'root'" class="dii-json-key">{{ name }}:</span>
      <span class="dii-json-value" :class="valueClass">{{ displayValue }}</span>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  data: { type: [Object, Array, String, Number, Boolean, null], default: null },
  depth: { type: Number, default: 0 },
})

// 默认展开前 2 层，更深自动折叠，避免一次性信息轰炸
const open = ref(props.depth < 2)

const isComposite = computed(() =>
  props.data !== null && typeof props.data === 'object'
)

const isArray = computed(() => Array.isArray(props.data))

const entries = computed(() => {
  if (isArray.value) return props.data
  return props.data
})

const typeHint = computed(() => {
  if (isArray.value) return `Array(${props.data.length})`
  if (isComposite.value) return `Object(${Object.keys(props.data).length})`
  return ''
})

const summary = computed(() => {
  if (isArray.value) {
    if (!props.data.length) return '[]'
    return `[${props.data.length} items]`
  }
  const keys = Object.keys(props.data || {})
  if (!keys.length) return '{}'
  return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''}}`
})

const displayValue = computed(() => {
  if (props.data === null) return 'null'
  if (typeof props.data === 'string') return `"${props.data}"`
  return String(props.data)
})

const valueClass = computed(() => {
  if (props.data === null) return 'v-null'
  if (typeof props.data === 'number') return 'v-number'
  if (typeof props.data === 'boolean') return 'v-bool'
  if (typeof props.data === 'string') return 'v-string'
  return ''
})
</script>

<style scoped>
.dii-json-node {
  margin: 1px 0;
}

.dii-json-toggle {
  display: inline-block;
  width: 12px;
  cursor: pointer;
  color: var(--text-faint);
  user-select: none;
  margin-right: 2px;
}

.dii-json-key {
  color: var(--code-var);
  margin-right: 4px;
}

.dii-json-type {
  color: var(--code-comment);
  font-size: 10.5px;
  margin-left: 4px;
}

.dii-json-summary {
  color: var(--text-faint);
  margin-left: 8px;
}

.dii-json-value {
  color: var(--code-text);
}

.v-string {
  color: var(--code-string);
}

.v-number {
  color: var(--code-number);
}

.v-bool {
  color: var(--code-keyword);
}

.v-null {
  color: var(--text-faint);
  font-style: italic;
}

.dii-json-children {
  margin-left: 4px;
  border-left: 1px dashed var(--border-subtle);
  padding-left: 4px;
}
</style>
