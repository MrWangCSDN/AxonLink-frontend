<template>
  <section aria-label="领域审批设置">
    <h3>领域审批设置</h3>
    <p>管理员配置授权领导和默认指派人。已有待审申请需在申请详情中显式转派。</p>
    <p v-if="!policiesLoaded && !error" role="status">正在读取领域审批设置…</p>
    <p v-if="error" class="reopen-error" role="alert">{{ error }}</p>
    <form class="reopen-panel" @submit.prevent="save">
      <label>
        问题所属领域
        <select v-model="domain" data-testid="policy-domain" :disabled="busy || !policiesLoaded">
          <option value="">请选择领域</option>
          <option v-for="name in allDomains" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <template v-if="domain && draft">
        <label>
          添加授权领导
          <ReplayReopenUserPicker v-model="candidate" data-testid="policy-user" label="授权领导" leaders />
          <button type="button" data-testid="add-policy-leader" :disabled="!candidate || busy || draft.leaderUsernames.includes(candidate)" @click="add">添加到授权名单</button>
        </label>
        <div class="reopen-policy-list">
          <span v-for="username in draft.leaderUsernames" :key="username">
            {{ username }}
            <button type="button" :disabled="busy" :aria-label="`移除 ${username}`" @click="remove(username)">移除</button>
          </span>
        </div>
        <p v-if="!draft.leaderUsernames.length">保存空授权名单会撤销该领域全部审批授权；待审申请保留，需后续显式转派。</p>
        <label>
          默认指派领导（名单非空时必选）
          <select v-model="draft.primaryLeaderUsername" data-testid="policy-primary">
            <option value="">请明确选择</option>
            <option v-for="username in draft.leaderUsernames" :key="username" :value="username">{{ username }}</option>
          </select>
        </label>
        <label>
          设置原因（必填）
          <textarea v-model="draft.reason" data-testid="policy-reason" required />
        </label>
        <div class="reopen-inline">
          <button type="submit" class="reopen-primary" :disabled="busy || !draft.reason.trim() || !validLeaders">保存领域审批设置</button>
        </div>
      </template>
    </form>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { getReopenPolicies, saveReopenPolicy } from '../../api/replayReopens.js'
import ReplayReopenUserPicker from './ReplayReopenUserPicker.vue'
const props = defineProps({ domains: { type: Array, default: () => [] } }), emit = defineEmits(['changed'])
const policies = ref([]), domain = ref(''), candidate = ref(''), drafts = reactive({}), error = ref(''), busy = ref(false), policiesLoaded = ref(false)
const allDomains = computed(() => [...new Set([...props.domains, ...policies.value.map(p => p.issueDomain)])])
const draft = computed(() => drafts[domain.value])
const validLeaders = computed(() => draft.value && (draft.value.leaderUsernames.length ? draft.value.leaderUsernames.includes(draft.value.primaryLeaderUsername) : !draft.value.primaryLeaderUsername))
let alive = true
watch([domain, policiesLoaded], ([value, loaded]) => { if (!loaded) return; candidate.value = ''; if (value && !drafts[value]) { const policy = policies.value.find(p => p.issueDomain === value); drafts[value] = { leaderUsernames: [...(policy?.leaderUsernames || [])], primaryLeaderUsername: policy?.primaryLeaderUsername || '', expectedVersion: policy?.version || 0, reason: '' } } })
function add() { if (candidate.value && !draft.value.leaderUsernames.includes(candidate.value)) draft.value.leaderUsernames.push(candidate.value); candidate.value = '' }
function remove(username) { draft.value.leaderUsernames = draft.value.leaderUsernames.filter(u => u !== username); if (draft.value.primaryLeaderUsername === username) draft.value.primaryLeaderUsername = '' }
async function save() {
  if (!policiesLoaded.value || busy.value || !draft.value?.reason.trim() || !validLeaders.value) return
  const selectedDomain = domain.value, body = { ...draft.value, leaderUsernames: [...draft.value.leaderUsernames], reason: draft.value.reason.trim() }; busy.value = true; error.value = ''
  try { const result = await saveReopenPolicy(selectedDomain, body); if (alive) { drafts[selectedDomain].expectedVersion = result.version; drafts[selectedDomain].reason = ''; emit('changed') } }
  catch (cause) { if (alive) error.value = cause.message }
  finally { if (alive) busy.value = false }
}
onMounted(async () => { try { const result = await getReopenPolicies(); if (alive) { policies.value = result; policiesLoaded.value = true } } catch (cause) { if (alive) error.value = cause.message } })
onBeforeUnmount(() => { alive = false })
</script>
