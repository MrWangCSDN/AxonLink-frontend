<template>
  <div class="reopen-mask">
    <section class="reopen-workbench" role="dialog" aria-modal="true" aria-label="重开责任调整台账">
      <header class="reopen-heading">
        <div>
          <h2>重开责任调整台账</h2>
          <p>永久记录每次重开，按发生批次追溯责任</p>
          <p>仅导入时“修复待验证 → 重新打开”计次；继承重开状态不重复计次，后续修改状态保留原重开记录。</p>
        </div>
        <button type="button" aria-label="关闭重开台账" @click="$emit('close')">关闭</button>
      </header>
      <p v-if="booting" role="status">正在读取台账权限…</p>
      <p v-else-if="permissions && !permissions.enabled" role="status">重开台账尚未启用，请完成数据迁移与权限配置后启用。</p>
      <p v-if="error" role="alert" class="reopen-error">{{ error }}</p>
      <template v-if="permissions?.enabled">
        <nav class="reopen-tabs" aria-label="台账功能">
          <button v-for="item in tabs" :key="item.key" :data-testid="`tab-${item.key}`" type="button" :aria-pressed="tab === item.key" @click="setTab(item.key)">{{ item.label }}</button>
        </nav>
        <form v-if="tab !== 'policies'" class="reopen-filters" @submit.prevent="applyFilters">
          <label>
            交易类型
            <select v-model="filters.replayType">
              <option value="ALL">全部</option>
              <option value="QUERY">查询</option>
              <option value="DZ">动账</option>
            </select>
          </label>
          <label>
            发生批次
            <select v-model="filters.batchName" data-testid="batch-filter">
              <option value="">全部发生批次</option>
              <option v-for="batch in options.batchNames" :key="batch" :value="batch">{{ batch }}</option>
            </select>
          </label>
          <label>
            问题所属领域
            <select v-model="filters.issueDomain">
              <option value="">全部领域</option>
              <option v-for="domain in options.issueDomains" :key="domain" :value="domain">{{ domain }}</option>
            </select>
          </label>
          <label>
            问题 key
            <input v-model="filters.issueKey" data-testid="issue-key-filter" placeholder="完整 issue_key" />
          </label>
          <label>
            来源导入轮次
            <input v-model="filters.sourceRoundId" data-testid="source-round-filter" type="number" min="1" step="1" placeholder="全部导入轮次" />
          </label>
          <label>
            事件编号
            <input v-model="filters.eventId" type="number" min="1" placeholder="单次重开" />
          </label>
          <label>
            当前负责人账号
            <input v-model="filters.ownerUsername" placeholder="完整账号" />
          </label>
          <label class="reopen-checkbox">
            <input v-model="filters.onlyMine" type="checkbox" />
            仅看本人
          </label>
          <template v-if="tab === 'appeals'">
            <label>
              申请状态
              <select v-model="appealFilters.status">
                <option value="">全部</option>
                <option v-for="(label, value) in statuses" :key="value" :value="value">{{ label }}</option>
              </select>
            </label>
            <label class="reopen-checkbox">
              <input v-model="appealFilters.assignedToMe" type="checkbox" />
              指派给我
            </label>
          </template>
          <button class="reopen-primary" type="submit" data-testid="apply-reopen-filters">应用筛选</button>
          <button type="button" data-testid="all-reopen-batches" @click="allBatches">全部批次</button>
        </form>
        <template v-if="tab === 'events'">
          <div class="reopen-section-heading">
            <p>按事件勾选，可跨批次保留选择；默认负责人为发生时快照。</p>
            <div class="reopen-inline">
              <button type="button" data-testid="open-adjustment" :disabled="!selected.length" @click="openRequest">申请调整（{{ selected.length }}）</button>
              <button type="button" :disabled="!selected.length" @click="clearSelection">清空选择</button>
            </div>
          </div>
          <p v-if="selectionError" role="alert" class="reopen-error">{{ selectionError }}</p>
          <div class="reopen-table-wrap" :aria-busy="loading">
            <table>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" aria-label="勾选当前页可申请事件" data-testid="select-page" :checked="allPageSelected" :disabled="!selectable.length" @change="selectPage($event.target.checked)" />
                  </th>
                  <th>问题 / 次序</th>
                  <th>发生批次 / 时间</th>
                  <th>领域 / 交易</th>
                  <th>默认负责人快照</th>
                  <th>当前负责人</th>
                  <th>最新调整状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in events.items" :key="item.event.id">
                  <td>
                    <input type="checkbox" :aria-label="`选择事件 ${item.event.id}`" :data-testid="`select-event-${item.event.id}`" :checked="selection.has(item.event.id)" :disabled="!item.canAppeal" @change="selectItem(item, $event.target.checked)" />
                  </td>
                  <td>
                    {{ item.event.issueKey }}
                    <small>第 {{ item.event.occurrenceNo }} 次 · #{{ item.event.id }}</small>
                    <small>{{ item.event.issueDescription }}</small>
                  </td>
                  <td>
                    {{ item.event.batchName }}
                    <small>{{ item.event.occurredAt }}</small>
                    <small v-if="item.event.sourceRoundId">导入轮次 #{{ item.event.sourceRoundId }}</small>
                  </td>
                  <td>
                    {{ item.event.issueDomain || item.event.groupName }}
                    <small>{{ item.event.transactionCode }}</small>
                  </td>
                  <td>
                    {{ owner(item.event.defaultOwnerName, item.event.defaultOwnerUsername) }}
                    <small>{{ item.event.developerSnapshot }}</small>
                  </td>
                  <td>{{ owner(item.event.currentOwnerName, item.event.currentOwnerUsername) }}</td>
                  <td>
                    <button v-if="item.latestAppeal" type="button" @click="openAppeal(item.latestAppeal.id)">{{ statuses[item.latestAppeal.status] || item.latestAppeal.status }} #{{ item.latestAppeal.id }}</button>
                    <span v-else>暂无调整申请</span>
                  </td>
                  <td>
                    <div class="reopen-actions">
                      <button type="button" :data-testid="`history-${item.event.id}`" @click="historyId = item.event.id">调整审计</button>
                      <button type="button" @click="singleStatistics(item.event.id)">单次统计</button>
                      <button v-if="item.canAssign" type="button" @click="assignment = item">确认归属</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!events.items.length">
                  <td colspan="8">{{ loading ? '正在读取…' : '当前范围暂无重开事件' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ReplayReopenPager :page="eventPage" :total="events.total" :loading="loading" prefix="events" @change="loadEvents" />
        </template>
        <template v-if="tab === 'appeals'">
          <div class="reopen-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>申请</th>
                  <th>领域 / 事件数</th>
                  <th>申请人</th>
                  <th>建议负责人</th>
                  <th>指派领导</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="appeal in appeals.items" :key="appeal.id">
                  <td>
                    #{{ appeal.id }} · {{ appeal.kind === 'RECHECK' ? '复核调整' : '责任调整' }}
                    <small>{{ appeal.submittedAt }}</small>
                  </td>
                  <td>{{ appeal.issueDomain }} / {{ appeal.items?.length || 0 }} 次</td>
                  <td>{{ owner(appeal.applicantName, appeal.applicantUsername) }}</td>
                  <td>{{ owner(appeal.suggestedOwnerName, appeal.suggestedOwnerUsername) }}</td>
                  <td>{{ owner(appeal.leaderName, appeal.leaderUsername) }}</td>
                  <td>{{ statuses[appeal.status] || appeal.status }}</td>
                  <td>
                    <button type="button" @click="appealId = appeal.id">查看 / 处理</button>
                  </td>
                </tr>
                <tr v-if="!appeals.items.length">
                  <td colspan="7">{{ loading ? '正在读取…' : '当前范围暂无调整申请' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ReplayReopenPager :page="appealPage" :total="appeals.total" :loading="loading" prefix="appeals" @change="loadAppeals" />
        </template>
        <ReplayReopenStatistics v-if="tab === 'statistics' && statistics" :data="statistics" />
        <ReplayReopenPolicies v-if="tab === 'policies' && permissions.canManagePermissions" :domains="permissions.issueDomains || options.issueDomains" @changed="refreshPermissions" />
        <ReplayReopenRequestForm v-if="requestOpened" v-show="tab === 'events'" :selection="selected" @close="requestOpened = false" @changed="requestChanged" />
        <ReplayReopenAssignment v-if="assignment" :item="assignment" @close="assignment = null" @changed="assignment = null; changed()" />
        <ReplayReopenAppealDetail v-if="appealId" :appeal-id="appealId" :policies="permissions.policies || []" @close="appealId = null" @history="historyId = $event" @changed="changed" />
        <ReplayReopenHistory v-if="historyId" :event-id="historyId" @close="historyId = null" />
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { getReopenPermissions, getReopenFilters, listReopenEvents, listReopenAppeals, getReopenStatistics } from '../../api/replayReopens.js'
import ReplayReopenPager from './ReplayReopenPager.vue'
import ReplayReopenRequestForm from './ReplayReopenRequestForm.vue'
import ReplayReopenStatistics from './ReplayReopenStatistics.vue'
import ReplayReopenHistory from './ReplayReopenHistory.vue'
import ReplayReopenAppealDetail from './ReplayReopenAppealDetail.vue'
import ReplayReopenAssignment from './ReplayReopenAssignment.vue'
import ReplayReopenPolicies from './ReplayReopenPolicies.vue'
const props = defineProps({ replayType: { type: String, default: 'ALL' }, issueKey: { type: String, default: '' }, sourceRoundId: { type: Number, default: null } })
const emit = defineEmits(['close', 'changed'])
const permissions = ref(null), booting = ref(true), error = ref(''), loading = ref(false), tab = ref('events')
const options = ref({ batchNames: [], issueDomains: [] })
const filters = reactive({ replayType: props.replayType, batchName: '', issueDomain: '', issueKey: props.issueKey, sourceRoundId: props.sourceRoundId ?? '', eventId: '', ownerUsername: '', onlyMine: false })
const applied = ref({ ...filters }), appealFilters = reactive({ status: '', assignedToMe: false }), appliedAppeal = ref({ ...appealFilters })
const events = ref({ items: [], total: 0 }), appeals = ref({ items: [], total: 0 }), statistics = ref(null), eventPage = ref(1), appealPage = ref(1)
const selection = reactive(new Map()), requestOpened = ref(false), selectionError = ref(''), historyId = ref(null), appealId = ref(null), assignment = ref(null)
const selected = computed(() => [...selection.values()]), selectable = computed(() => events.value.items.filter(item => item.canAppeal))
const allPageSelected = computed(() => selectable.value.length > 0 && selectable.value.every(item => selection.has(item.event.id)))
const tabs = computed(() => [{ key: 'events', label: '重开台账' }, { key: 'appeals', label: '调整申请' }, { key: 'statistics', label: '人员与批次统计' }, ...(permissions.value?.canManagePermissions ? [{ key: 'policies', label: '领域审批设置' }] : [])])
const statuses = { PENDING: '待审批', APPROVED: '已通过', REJECTED: '已驳回', WITHDRAWN: '已撤回', INVALID: '已失效' }
const owner = (name, username) => name ? `${name}${username ? ` (${username})` : ''}` : username || '待归属'
let listSerial = 0, optionsSerial = 0, alive = true
function selectItem(item, checked) { if (checked && item.canAppeal) selection.set(item.event.id, item); else selection.delete(item.event.id) }
function selectPage(checked) { selectable.value.forEach(item => selectItem(item, checked)) }
function clearSelection() { selection.clear(); requestOpened.value = false; selectionError.value = '' }
function openRequest() {
  const first = selected.value[0]
  if (!first || selected.value.length > 50 || !selected.value.every(item => item.canAppeal && item.event.issueDomain === first.event.issueDomain && item.event.currentOwnerUsername === first.event.currentOwnerUsername && !!item.requiresRecheck === !!first.requiresRecheck)) {
    selectionError.value = '请选择同一领域、同一当前负责人且同为首次调整或复核的事件，每份最多 50 次。'; return
  }
  selectionError.value = ''; requestOpened.value = true
}
async function readList(fetcher, nextPage, destination, pageRef) {
  const serial = ++listSerial; loading.value = true; error.value = ''
  try {
    const result = await fetcher()
    if (!alive || serial !== listSerial) return
    destination.value = result; pageRef.value = nextPage
    if (destination === events) for (const item of result.items) if (selection.has(item.event.id)) { if (item.canAppeal) selection.set(item.event.id, item); else selection.delete(item.event.id) }
  } catch (cause) { if (alive && serial === listSerial) error.value = cause.message || '读取失败，请重试' }
  finally { if (alive && serial === listSerial) loading.value = false }
}
const loadEvents = (page = 1) => readList(() => listReopenEvents({ ...applied.value, page, pageSize: 20 }), page, events, eventPage)
const loadAppeals = (page = 1) => readList(() => listReopenAppeals({ ...applied.value, ...appliedAppeal.value, page, pageSize: 20 }), page, appeals, appealPage)
async function loadStatistics() {
  const serial = ++listSerial; loading.value = true; error.value = ''
  try { const data = await getReopenStatistics({ ...applied.value }); if (alive && serial === listSerial) statistics.value = data }
  catch (cause) { if (alive && serial === listSerial) error.value = cause.message }
  finally { if (alive && serial === listSerial) loading.value = false }
}
function refresh() { if (tab.value === 'events') return loadEvents(eventPage.value); if (tab.value === 'appeals') return loadAppeals(appealPage.value); if (tab.value === 'statistics') return loadStatistics() }
function setTab(value) { tab.value = value; refresh() }
async function loadOptions() {
  const serial = ++optionsSerial
  try { const result = await getReopenFilters({ replayType: applied.value.replayType }); if (alive && serial === optionsSerial) options.value = result }
  catch (cause) { if (alive && serial === optionsSerial) error.value = cause.message }
}
function applyFilters() { applied.value = { ...filters }; appliedAppeal.value = { ...appealFilters }; eventPage.value = 1; appealPage.value = 1; loadOptions(); refresh() }
function allBatches() { filters.batchName = ''; filters.issueKey = ''; filters.sourceRoundId = ''; filters.eventId = ''; applyFilters() }
function singleStatistics(id) { filters.eventId = id; applied.value = { ...filters }; tab.value = 'statistics'; loadStatistics() }
function openAppeal(id) { appealId.value = id }
function changed() { emit('changed'); refresh() }
function requestChanged() { clearSelection(); changed() }
async function refreshPermissions() { const result = await getReopenPermissions(); if (alive) permissions.value = result }
onMounted(async () => {
  try { await refreshPermissions(); if (alive && permissions.value?.enabled) { loadOptions(); loadEvents() } }
  catch (cause) { if (alive) error.value = cause.message }
  finally { if (alive) booting.value = false }
})
onBeforeUnmount(() => { alive = false; listSerial++; optionsSerial++ })
</script>
<style src="./replayReopen.css"></style>
