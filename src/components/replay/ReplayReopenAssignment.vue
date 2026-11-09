<template>
  <section class="reopen-panel" aria-label="待归属确认">
    <div class="reopen-section-heading">
      <h3>事件 #{{ item.event.id }} · 待归属确认</h3>
      <button type="button" @click="$emit('close')">收起</button>
    </div>
    <p>只确认本次重开的当前负责人，默认快照和重开总次数保留。</p>
    <form v-if="item.canAssign" @submit.prevent="submit">
      <label>
        开发负责人（必选）
        <ReplayReopenUserPicker v-model="owner" data-testid="assignment-owner" label="确认开发负责人" />
      </label>
      <label>
        确认原因（必填）
        <textarea v-model="reason" data-testid="assignment-reason" required />
      </label>
      <p v-if="error" role="alert" class="reopen-error">{{ error }}</p>
      <div class="reopen-inline">
        <button type="submit" class="reopen-primary" :disabled="busy || !owner || !reason.trim()">确认当前归属</button>
      </div>
    </form>
    <p v-else>当前账号不能确认此事件的归属。</p>
  </section>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { assignReopenEvent } from '../../api/replayReopens.js'
import ReplayReopenUserPicker from './ReplayReopenUserPicker.vue'
const props = defineProps({ item: { type: Object, required: true } }), emit = defineEmits(['close', 'changed'])
const owner = ref(''), reason = ref(''), error = ref(''), busy = ref(false)
let serial = 0
watch(() => props.item.event.id, () => { serial++; owner.value = ''; reason.value = ''; error.value = ''; busy.value = false })
async function submit() {
  if (!props.item.canAssign || busy.value || !owner.value || !reason.value.trim()) return
  const token = serial; busy.value = true; error.value = ''
  try { await assignReopenEvent(props.item.event.id, { expectedVersion: props.item.event.version, targetOwnerUsername: owner.value, reason: reason.value.trim() }); if (token === serial) emit('changed') }
  catch (cause) { if (token === serial) error.value = cause.message }
  finally { if (token === serial) busy.value = false }
}
onBeforeUnmount(() => { serial++ })
</script>
