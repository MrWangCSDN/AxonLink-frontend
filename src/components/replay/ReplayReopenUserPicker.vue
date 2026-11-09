<template>
  <div class="reopen-user-picker">
    <div class="reopen-inline">
      <input v-model="keyword" :aria-label="`${label}搜索`" placeholder="姓名或账号" @input="search" />
      <button type="button" :disabled="loading" @click="search">搜索</button>
    </div>
    <select :value="modelValue" :aria-label="label" @change="$emit('update:modelValue', $event.target.value)">
      <option value="">请明确选择{{ label }}</option>
      <option v-for="user in choices" :key="user.username" :value="user.username">{{ user.displayName || `${user.realName || user.username} (${user.username})` }}</option>
    </select>
    <small v-if="loading">正在搜索…</small>
    <small v-if="error" role="alert">{{ error }}</small>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { searchReopenDevelopers } from '../../api/replayReopens.js'
import { searchReplayIssueUsers } from '../../api/replayIssues.js'
const props = defineProps({ modelValue: { type: String, default: '' }, label: { type: String, default: '开发负责人' }, leaders: Boolean })
defineEmits(['update:modelValue'])
const keyword = ref(''), options = ref([]), selectedOption = ref(null), error = ref(''), loading = ref(false)
const choices = computed(() => selectedOption.value && !options.value.some(u => u.username === selectedOption.value.username) ? [selectedOption.value, ...options.value] : options.value)
let serial = 0
async function search() {
  const request = ++serial
  selectedOption.value = choices.value.find(u => u.username === props.modelValue) || selectedOption.value
  loading.value = true; error.value = ''
  try {
    const result = await (props.leaders ? searchReplayIssueUsers : searchReopenDevelopers)(keyword.value, 20)
    if (serial === request) options.value = result || []
  } catch (cause) { if (serial === request) error.value = cause.message || '搜索失败' }
  finally { if (serial === request) loading.value = false }
}
onMounted(search)
onBeforeUnmount(() => { serial++ })
</script>
