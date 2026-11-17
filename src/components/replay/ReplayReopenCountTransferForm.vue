<template>
  <section class="reopen-panel reopen-count-transfer" aria-label="转移问题次数">
    <div class="reopen-section-heading">
      <h3>转移问题次数</h3>
      <button type="button" :disabled="busy" @click="$emit('close')">关闭调整</button>
    </div>
    <p>来源负责人 {{ person.realName || person.username || '待归属' }}<span v-if="person.username">（{{ person.username }}）</span> · 当前问题数 {{ person.currentCount || 0 }} · 可转 {{ transferableCount }} 次</p>
    <p>本次统计范围 {{ typeLabels[scope.replayType] || scope.replayType }} · {{ scope.batchNames?.length ? scope.batchNames.join('、') : '全部发生批次' }}</p>
    <p v-if="person.pendingCount">{{ person.pendingCount }} 次正在处理中，本次可转数量已扣除。</p>
    <p v-if="!canTransferCounts" role="status">当前账号没有次数调整权限。</p>
    <form data-testid="count-transfer-form" @submit.prevent="submit">
      <fieldset class="reopen-transfer-fields" :disabled="busy || !canTransferCounts">
        <label>
          转入开发负责人（必选）
          <ReplayReopenUserPicker v-model="targetOwner" data-testid="count-transfer-target" label="转入开发负责人" />
        </label>
        <label>
          转移次数（必填）
          <input v-model="count" data-testid="count-transfer-amount" type="number" min="1" :max="maximumCount" step="1" required />
          <small>每次最多调整 {{ maximumCount }} 次。</small>
        </label>
        <label>
          调整原因（必填）
          <textarea v-model="reason" data-testid="count-transfer-reason" maxlength="1000" required />
        </label>
      </fieldset>
      <p v-if="error" role="alert" class="reopen-error">{{ error }}</p>
      <div class="reopen-inline">
        <button type="submit" class="reopen-primary" data-testid="submit-count-transfer" :disabled="busy || !valid">{{ busy ? '正在调整…' : '确认转移' }}</button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { transferReopenCounts } from '../../api/replayReopens.js'
import ReplayReopenUserPicker from './ReplayReopenUserPicker.vue'
import { newReopenRequestId } from './reopenRequestId.js'

const props = defineProps({
  person: { type: Object, required: true },
  scope: { type: Object, required: true },
  canTransferCounts: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'changed', 'busy'])
const targetOwner = ref('')
const count = ref('')
const reason = ref('')
const error = ref('')
const busy = ref(false)
const typeLabels = { ALL: '全部交易类型', QUERY: '查询', DZ: '动账' }
const transferableCount = computed(() => Math.max(0, (props.person.currentCount || 0) - (props.person.pendingCount || 0)))
const maximumCount = computed(() => Math.min(10000, transferableCount.value))
const valid = computed(() => props.canTransferCounts
  && targetOwner.value && targetOwner.value !== props.person.username
  && Number.isSafeInteger(Number(count.value)) && Number(count.value) >= 1 && Number(count.value) <= maximumCount.value
  && reason.value.trim().length > 0 && reason.value.trim().length <= 1000)
let serial = 0
let requestId = ''
let signature = ''

watch(busy, value => emit('busy', value), { flush: 'sync' })

watch([() => props.person, () => props.scope], () => {
  serial++
  targetOwner.value = ''
  count.value = ''
  reason.value = ''
  error.value = ''
  busy.value = false
  requestId = ''
  signature = ''
})

async function submit() {
  if (busy.value || !valid.value) return
  const token = serial
  const body = {
    replayType: props.scope.replayType,
    batchNames: [...(props.scope.batchNames || [])],
    sourceOwnerUsername: props.person.username || null,
    targetOwnerUsername: targetOwner.value,
    count: Number(count.value),
    reason: reason.value.trim(),
  }
  const nextSignature = JSON.stringify(body)
  busy.value = true
  error.value = ''
  try {
    if (nextSignature !== signature) {
      requestId = newReopenRequestId()
      signature = nextSignature
    }
    const result = await transferReopenCounts({ requestId, ...body })
    if (token === serial) emit('changed', result)
  } catch (cause) {
    if (token === serial) error.value = cause.message || '调整失败，请保留草稿后重试'
  } finally {
    if (token === serial) busy.value = false
  }
}

onBeforeUnmount(() => { serial++ })
</script>
