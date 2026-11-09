<template>
  <section class="reopen-panel" aria-label="申请责任调整">
    <h3>{{ kind === 'RECHECK' ? '申请复核调整' : '申请责任调整' }} · {{ selection.length }} 次重开</h3>
    <p v-if="kind === 'RECHECK'">请补充新证据。复核期间现有归属继续生效，历史裁定依据不能重复使用。</p>
    <p>同一领域、同一当前负责人，每份申请最多 50 次，可跨问题和发生批次。</p>
    <form @submit.prevent="submit">
      <label>
        建议开发负责人（必选）
        <ReplayReopenUserPicker v-model="draft.owner" data-testid="suggested-owner" label="建议开发负责人" />
      </label>
      <label>
        调整原因（必填）
        <textarea v-model="draft.reason" data-testid="request-reason" required />
      </label>
      <label>
        证据（必填）
        <textarea v-model="draft.evidence" data-testid="request-evidence" required placeholder="日志、提交记录或可核实的证据" />
      </label>
      <p v-if="error" role="alert" class="reopen-error">{{ error }}</p>
      <div class="reopen-inline">
        <button class="reopen-primary" type="submit" data-testid="submit-adjustment" :disabled="busy || !valid">{{ busy ? '提交中…' : '提交调整申请' }}</button>
        <button type="button" :disabled="busy" @click="$emit('close')">收起草稿</button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { createReopenAppeal } from '../../api/replayReopens.js'
import ReplayReopenUserPicker from './ReplayReopenUserPicker.vue'
const props = defineProps({ selection: { type: Array, required: true } })
const emit = defineEmits(['changed', 'close'])
const draft = reactive({ owner: '', reason: '', evidence: '' }), busy = ref(false), error = ref('')
const kind = computed(() => props.selection[0]?.requiresRecheck ? 'RECHECK' : 'APPEAL')
const compatible = computed(() => {
  const first = props.selection[0]
  return first && props.selection.length <= 50 && props.selection.every(item => item.canAppeal && item.event.issueDomain === first.event.issueDomain && item.event.currentOwnerUsername === first.event.currentOwnerUsername && !!item.requiresRecheck === !!first.requiresRecheck)
})
const valid = computed(() => compatible.value && draft.owner && draft.owner !== props.selection[0]?.event.currentOwnerUsername && draft.reason.trim() && draft.evidence.trim())
let requestId = '', signature = ''
function newRequestId() {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('当前浏览器无法生成安全的请求编号，请更换浏览器后重试；草稿已保留。')
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
async function submit() {
  if (busy.value || !valid.value) return
  const body = { eventIds: props.selection.map(item => item.event.id), expectedVersions: Object.fromEntries(props.selection.map(item => [item.event.id, item.event.version])), kind: kind.value, suggestedOwnerUsername: draft.owner, reason: draft.reason.trim(), evidence: draft.evidence.trim() }
  const nextSignature = JSON.stringify(body)
  busy.value = true; error.value = ''
  try {
    if (signature !== nextSignature) { requestId = newRequestId(); signature = nextSignature }
    await createReopenAppeal({ requestId, ...body })
    emit('changed')
  }
  catch (cause) { error.value = cause.message || '提交失败，请保留草稿后重试' }
  finally { busy.value = false }
}
</script>
