<template>
  <section class="reopen-panel" aria-label="调整审计">
    <div class="reopen-section-heading">
      <h3>事件 #{{ eventId }} · 调整审计</h3>
      <button type="button" @click="$emit('close')">收起审计</button>
    </div>
    <p v-if="error" role="alert" class="reopen-error">{{ error }}</p>
    <div class="reopen-table-wrap">
      <table>
        <thead>
          <tr>
            <th>时间 / 操作</th>
            <th>操作人</th>
            <th>归属记录</th>
            <th>原因与证据</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in result.items" :key="entry.id">
            <td>
              {{ entry.occurredAt }}
              <small>{{ labels[entry.action] || entry.action }}</small>
            </td>
            <td>{{ entry.operatorName || entry.operatorUsername }}</td>
            <td>{{ attributionRecord(entry) }}</td>
            <td class="reopen-prose">
              {{ entry.reason || '—' }}
              <small>{{ entry.evidence }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <ReplayReopenPager :page="page" :total="result.total" :loading="loading" prefix="history" @change="load" />
  </section>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { getReopenHistory } from '../../api/replayReopens.js'
import ReplayReopenPager from './ReplayReopenPager.vue'
const props = defineProps({ eventId: Number })
defineEmits(['close'])
const result = ref({ items: [], total: 0 }), page = ref(1), loading = ref(false), error = ref('')
const labels = {
  REOPEN_RECORDED: '记录重开事实', REOPEN_BACKFILLED: '历史重开回填',
  APPEAL_SUBMITTED: '提交调整或复核', APPEAL_APPROVED: '通过调整',
  APPEAL_REJECTED: '驳回调整', APPEAL_WITHDRAWN: '撤回调整',
  APPEAL_INVALIDATED: '调整申请失效', APPEAL_REASSIGNED: '转派审批领导',
  OWNER_ASSIGNED: '确认待归属负责人', POLICY_UPDATED: '调整领域审批权限',
}
function attributionRecord(entry) {
  const from = entry.fromOwnerName || entry.fromOwnerUsername || '待归属'
  const to = entry.toOwnerName || entry.toOwnerUsername || '待归属'
  if (entry.action === 'APPEAL_SUBMITTED') return `建议：${from} → ${to}（未生效）`
  if (entry.action === 'APPEAL_APPROVED' || entry.action === 'OWNER_ASSIGNED') return `${from} → ${to}（已生效）`
  if (entry.action === 'REOPEN_RECORDED' || entry.action === 'REOPEN_BACKFILLED') return `初始归属：${to}`
  return `归属未变：${to}`
}
let serial = 0
async function load(next = 1) {
  const request = ++serial; loading.value = true; error.value = ''
  try { const data = await getReopenHistory(props.eventId, { page: next, pageSize: 20 }); if (request === serial) { result.value = data; page.value = next } }
  catch (cause) { if (request === serial) error.value = cause.message }
  finally { if (request === serial) loading.value = false }
}
watch(() => props.eventId, () => { result.value = { items: [], total: 0 }; load(1) }, { immediate: true })
onBeforeUnmount(() => { serial++ })
</script>
