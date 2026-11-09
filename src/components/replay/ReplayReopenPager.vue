<template>
  <div class="reopen-pager">
    <span>共 {{ total }} 条 · 第 {{ page }} / {{ Math.max(1, Math.ceil(total / pageSize)) }} 页</span>
    <button type="button" :data-testid="`${prefix}-previous`" :disabled="loading || page <= 1" @click="$emit('change', page - 1)">上一页</button>
    <button type="button" :data-testid="`${prefix}-next`" :disabled="loading || page * pageSize >= total" @click="$emit('change', page + 1)">下一页</button>
  </div>
</template>

<script setup>
defineProps({ page: Number, total: Number, pageSize: { type: Number, default: 20 }, loading: Boolean, prefix: String })
defineEmits(['change'])
</script>
