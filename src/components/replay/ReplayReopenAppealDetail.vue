<template>
  <section class="reopen-panel" aria-label="调整申请详情">
    <div class="reopen-section-heading">
      <h3>调整申请 #{{ appealId }}</h3>
      <button type="button" @click="$emit('close')">收起详情</button>
    </div>
    <p v-if="loading" role="status">正在读取申请…</p>
    <p v-if="error" class="reopen-error" role="alert">{{ error }}</p>
    <template v-if="detail">
      <div class="reopen-detail-grid">
        <p>
          状态：
          <strong>{{ statuses[detail.status] || detail.status }}</strong>
          · {{ detail.kind === 'RECHECK' ? '复核调整' : '责任调整' }}
          <br />
          领域：{{ detail.issueDomain }}
        </p>
        <p>
          申请人：{{ person(detail.applicantName, detail.applicantUsername) }}
          <br />
          指派领导：{{ person(detail.leaderName, detail.leaderUsername) }}
        </p>
        <p>
          建议负责人：{{ person(detail.suggestedOwnerName, detail.suggestedOwnerUsername) }}
          <br />
          最终负责人：{{ person(detail.finalOwnerName, detail.finalOwnerUsername) }}
        </p>
        <p>
          提交时间：{{ detail.submittedAt }}
          <br />
          裁定时间：{{ detail.decidedAt || '—' }}
        </p>
      </div>
      <p class="reopen-prose">
        调整原因：{{ detail.reason }}
        <br />
        证据：{{ detail.evidence }}
        <br v-if="detail.decisionReason" />
        {{ detail.decisionReason ? `裁定原因：${detail.decisionReason}` : '' }}
        <br v-if="detail.closeReason" />
        {{ detail.closeReason ? `关闭原因：${detail.closeReason}` : '' }}
      </p>
      <div class="reopen-table-wrap">
        <table>
          <thead>
            <tr>
              <th>问题 / 次序</th>
              <th>发生批次</th>
              <th>调整前负责人</th>
              <th>审计</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in detail.items || []" :key="item.eventId">
              <td>{{ item.issueKey }} · 第 {{ item.occurrenceNo }} 次</td>
              <td>{{ item.batchName }}</td>
              <td>{{ person(item.beforeOwnerName, item.beforeOwnerUsername) }}</td>
              <td>
                <button type="button" @click="$emit('history', item.eventId)">查看调整审计</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <form v-if="detail.canDecide" @submit.prevent>
        <label>
          最终开发负责人（通过时必选）
          <ReplayReopenUserPicker v-model="draft.finalOwner" data-testid="final-owner" label="最终开发负责人" />
        </label>
        <label>
          裁定原因（必填）
          <textarea v-model="draft.decisionReason" data-testid="decision-reason" required />
        </label>
        <p>请核实后主动选择最终负责人，可与建议人不同。涉及本人应回避，系统会再次检查权限与事件版本。</p>
        <div class="reopen-inline">
          <button class="reopen-primary" type="button" data-testid="approve-adjustment" :disabled="busy || !draft.finalOwner || !draft.decisionReason.trim()" @click="decide('APPROVE')">通过调整</button>
          <button type="button" data-testid="reject-adjustment" :disabled="busy || !draft.decisionReason.trim()" @click="decide('REJECT')">驳回调整</button>
        </div>
      </form>
      <form v-if="detail.canWithdraw" @submit.prevent="withdraw">
        <label>
          撤回原因（必填）
          <textarea v-model="draft.withdrawReason" data-testid="withdraw-reason" required />
        </label>
        <div class="reopen-inline">
          <button type="button" data-testid="withdraw-adjustment" :disabled="busy || !draft.withdrawReason.trim()" @click="withdraw">撤回调整申请</button>
        </div>
      </form>
      <form v-if="detail.canReassign" @submit.prevent="reassign">
        <label>
          转派至授权领导
          <select v-model="draft.leader" data-testid="reassign-leader">
            <option value="">请选择授权领导</option>
            <option v-for="username in leaders" :key="username" :value="username">{{ username }}</option>
          </select>
        </label>
        <label>
          转派原因（必填）
          <textarea v-model="draft.reassignReason" data-testid="reassign-reason" required />
        </label>
        <div class="reopen-inline">
          <button type="button" data-testid="reassign-adjustment" :disabled="busy || !leaders.includes(draft.leader) || !draft.reassignReason.trim()" @click="reassign">转派待审申请</button>
        </div>
      </form>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { getReopenAppeal, decideReopenAppeal, withdrawReopenAppeal, reassignReopenAppeal } from '../../api/replayReopens.js'
import ReplayReopenUserPicker from './ReplayReopenUserPicker.vue'
const props = defineProps({ appealId: Number, policies: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'changed', 'history'])
const detail = ref(null), loading = ref(false), busy = ref(false), error = ref('')
const emptyDraft = () => ({ finalOwner: '', decisionReason: '', withdrawReason: '', leader: '', reassignReason: '' })
const draft = reactive(emptyDraft())
const statuses = { PENDING: '待审批', APPROVED: '已通过', REJECTED: '已驳回', WITHDRAWN: '已撤回', INVALID: '已失效' }
const person = (name, username) => name ? `${name}${username ? ` (${username})` : ''}` : username || '—'
const leaders = computed(() => props.policies.find(policy => policy.issueDomain === detail.value?.issueDomain)?.leaderUsernames || [])
let serial = 0
watch(() => props.appealId, async id => {
  const token = ++serial; detail.value = null; loading.value = true; busy.value = false; error.value = ''; Object.assign(draft, emptyDraft())
  try { const data = await getReopenAppeal(id); if (serial === token) detail.value = data }
  catch (cause) { if (serial === token) error.value = cause.message }
  finally { if (serial === token) loading.value = false }
}, { immediate: true })
async function perform(operation, body) {
  if (busy.value || !detail.value) return
  const token = serial, id = props.appealId, version = detail.value.version
  busy.value = true; error.value = ''
  try { const result = await operation(id, { expectedVersion: version, ...body }); if (token === serial) { detail.value = result; emit('changed') } }
  catch (cause) { if (token === serial) error.value = cause.message || '操作失败，草稿已保留' }
  finally { if (token === serial) busy.value = false }
}
function decide(decision) { if (!detail.value?.canDecide || !draft.decisionReason.trim() || (decision === 'APPROVE' && !draft.finalOwner)) return; return perform(decideReopenAppeal, { decision, finalOwnerUsername: decision === 'APPROVE' ? draft.finalOwner : null, reason: draft.decisionReason.trim() }) }
function withdraw() { if (detail.value?.canWithdraw && draft.withdrawReason.trim()) return perform(withdrawReopenAppeal, { reason: draft.withdrawReason.trim() }) }
function reassign() { if (detail.value?.canReassign && leaders.value.includes(draft.leader) && draft.reassignReason.trim()) return perform(reassignReopenAppeal, { leaderUsername: draft.leader, reason: draft.reassignReason.trim() }) }
onBeforeUnmount(() => { serial++ })
</script>
