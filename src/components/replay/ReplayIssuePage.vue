<template>
  <section class="replay-page" aria-label="并行回放问题清单">
    <header class="replay-toolbar">
      <div class="replay-toolbar-title">
        <button
          class="replay-icon-button replay-mobile-navigation"
          type="button"
          title="打开导航"
          aria-label="打开导航"
          data-testid="mobile-navigation-toggle"
          @click="$emit('toggleNavigation')"
        >
          <Menu :size="18" aria-hidden="true" />
        </button>
        <div>
          <h2>并行回放问题清单</h2>
          <p v-if="stats.importedAt">最近导入：{{ stats.importedAt }}</p>
        </div>
      </div>
      <button class="replay-button replay-button-primary" type="button" data-testid="open-import" @click="openImport">
        <Upload :size="16" aria-hidden="true" />
        导入 Excel
      </button>
    </header>

    <div class="replay-summary" aria-label="汇总数据">
      <div v-for="card in summaryCards" :key="card.key" class="replay-summary-card" tabindex="0">
        <span>{{ card.label }}</span><strong>{{ summaryValue(card) }}</strong>
        <div class="replay-summary-tooltip" role="tooltip">
          <div v-for="group in summaryGroups" :key="group"><span>{{ group }}</span><b>{{ groupSummary(card, group) }}</b></div>
        </div>
      </div>
    </div>

    <form class="replay-filters" @submit.prevent="query">
      <label>
        <span>领域</span>
        <select v-model="filters.groupName" data-testid="group-filter">
          <option value="">全部</option>
          <option v-for="group in options.groups" :key="group" :value="group">{{ group }}</option>
        </select>
      </label>
      <label>
        <span>是否沙箱</span>
        <select v-model="filters.sandbox" data-testid="sandbox-filter">
          <option value="">全部</option>
          <option value="true">是</option>
          <option value="false">否</option>
        </select>
      </label>
      <label>
        <span>问题级别</span>
        <select v-model="filters.issueLevel" data-testid="issue-level-filter">
          <option value="">全部</option>
          <option v-for="level in options.issueLevels" :key="level" :value="level">{{ level }}</option>
        </select>
      </label>
      <label>
        <span>问题类型</span>
        <select v-model="filters.issueType" data-testid="issue-type-filter">
          <option value="">全部</option>
          <option v-for="type in options.issueTypes" :key="type" :value="type">{{ type }}</option>
        </select>
      </label>
      <label>
        <span>问题状态</span>
        <select v-model="filters.issueStatus" data-testid="issue-status-filter">
          <option value="">全部</option>
          <option v-for="status in options.issueStatuses" :key="status" :value="status">{{ status }}</option>
        </select>
      </label>
      <label>
        <span>交易负责人</span>
        <input v-model.trim="filters.transactionOwner" data-testid="transaction-owner-filter" type="search" placeholder="模糊查询" />
      </label>
      <label>
        <span>需协同人</span>
        <input v-model.trim="filters.cooperationPerson" data-testid="cooperation-person-filter" type="search" placeholder="姓名或账号" />
      </label>
      <label class="replay-keyword-field">
        <span>关键词</span>
        <input v-model.trim="filters.keyword" data-testid="keyword-filter" type="search" placeholder="交易码、名称或问题描述" />
      </label>
      <button class="replay-button replay-button-primary" type="button" data-testid="query-button" :disabled="loading" @click="query">
        <Search :size="16" aria-hidden="true" />
        查询
      </button>
      <button class="replay-icon-button" type="button" title="重置筛选" aria-label="重置筛选" @click="resetFilters">
        <RotateCcw :size="16" aria-hidden="true" />
      </button>
    </form>

    <div class="replay-table-viewport" data-testid="table-viewport">
      <table class="replay-table">
        <colgroup><col v-for="column in columns" :key="column.key" :style="{ width: column.width }" /></colgroup>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key" scope="col">
              <span>{{ column.label }}</span>
              <HelpCircle v-if="column.key === 'final_solution'" :size="14" title="填写最终采用的修复方案和处理结果" aria-label="最终处理方案说明" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id" data-testid="replay-row">
            <td v-for="column in columns" :key="column.key" :title="displayColumn(column.key, row[column.key])">
              <div v-if="column.key === 'operation'" class="replay-operation-buttons">
                <button class="replay-button replay-button-compact" type="button" :data-testid="`edit-${row.id}`" @click="openEdit(row)"><Pencil :size="13" aria-hidden="true" />编辑</button>
                <button class="replay-button replay-button-compact" type="button" :data-testid="`tracking-${row.id}`" @click="openTracking(row)"><HistoryIcon :size="13" aria-hidden="true" />问题跟踪</button>
              </div>
              <span v-else-if="manualDisplayKeys.has(column.key)" class="replay-manual-value">{{ displayColumn(column.key, row[column.key]) }}</span>
              <template v-else>{{ displayColumn(column.key, row[column.key]) }}</template>
            </td>
          </tr>
          <tr v-if="!loading && !error && items.length === 0"><td class="replay-state" :colspan="columns.length">暂无回放问题数据</td></tr>
          <tr v-if="loading"><td class="replay-state" :colspan="columns.length">正在加载回放问题…</td></tr>
          <tr v-if="error"><td class="replay-state replay-error" :colspan="columns.length">{{ error }}</td></tr>
        </tbody>
      </table>
    </div>

    <footer class="replay-pager">
      <span>共 {{ total }} 条，第 {{ page + 1 }} / {{ pageCount }} 页</span>
      <label>
        每页
        <select :value="pageSize" data-testid="page-size" @change="changePageSize">
          <option :value="50">50</option>
          <option :value="100">100</option>
          <option :value="200">200</option>
        </select>
        条
      </label>
      <div class="replay-page-actions">
        <button class="replay-icon-button" type="button" title="上一页" aria-label="上一页" data-testid="previous-page" :disabled="page === 0 || loading" @click="goPrevious">
          <ChevronLeft :size="18" aria-hidden="true" />
        </button>
        <button class="replay-icon-button" type="button" title="下一页" aria-label="下一页" data-testid="next-page" :disabled="page + 1 >= pageCount || loading" @click="goNext">
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
      </div>
    </footer>

    <div v-if="importOpen" class="replay-modal-mask" @click.self="!importing && closeImport()">
      <section class="replay-import-modal" role="dialog" aria-modal="true" aria-labelledby="replay-import-title">
        <header>
          <div>
            <h3 id="replay-import-title">导入回放问题</h3>
            <p>上传 Excel 文件后将按 issue_key 合并问题状态。</p>
          </div>
          <button class="replay-icon-button" type="button" title="关闭导入窗口" aria-label="关闭导入窗口" :disabled="importing" @click="closeImport"><X :size="16" aria-hidden="true" /></button>
        </header>
        <label class="replay-file-field">
          <span>Excel 文件</span>
          <input data-testid="import-file" type="file" accept=".xlsx,.xls" :disabled="importing" @change="selectImportFile" />
          <small>{{ importFile?.name || '请选择 .xlsx 或 .xls 文件' }}</small>
        </label>
        <label>
          <span>导入口令</span>
          <input v-model="importToken" data-testid="import-token" type="password" autocomplete="off" :disabled="importing" placeholder="X-DII-Trigger-Token" />
        </label>
        <p v-if="importMessage" class="replay-import-message" :class="{ 'is-error': importError }">{{ importMessage }}</p>
        <footer>
          <button class="replay-button" type="button" :disabled="importing" @click="closeImport">取消</button>
          <button class="replay-button replay-button-primary" type="button" data-testid="submit-import" :disabled="!importFile || importing || importComplete" @click="submitImport">
            <Upload :size="16" aria-hidden="true" />
            {{ importing ? '导入中…' : (importComplete ? '已导入' : '开始导入') }}
          </button>
        </footer>
      </section>
    </div>

    <div v-if="editOpen" class="replay-modal-mask">
      <section class="replay-edit-modal" role="dialog" aria-modal="true" aria-labelledby="replay-edit-title" data-testid="edit-modal">
        <header>
          <div>
            <h3 id="replay-edit-title">编辑回放问题</h3>
          </div>
          <button class="replay-icon-button" type="button" title="关闭编辑窗口" aria-label="关闭编辑窗口" :disabled="savingId === editIssue?.id" @click="closeEdit"><X :size="16" aria-hidden="true" /></button>
        </header>
        <div class="replay-edit-grid">
          <label>
            <span>问题状态</span>
            <select v-model="editDraft.issueStatus" data-testid="edit-status">
              <option value="" disabled>{{ editIssue && !manualStatuses.includes(editIssue.issue_status) ? `当前：${display(editIssue.issue_status)}，请选择` : '请选择状态' }}</option>
              <option v-for="status in manualStatuses" :key="status" :value="status">{{ status }}</option>
            </select>
          </label>
          <label>
            <span>问题类型</span>
            <select v-model="editDraft.issueType" data-testid="edit-type">
              <option value="">请选择</option>
              <option v-for="type in issueTypes" :key="type" :value="type">{{ type }}</option>
            </select>
          </label>
          <label class="replay-edit-wide">
            <span>初步问题分析 <em>{{ editDraft.initialAnalysis.length }}/500</em></span>
            <textarea v-model="editDraft.initialAnalysis" maxlength="500" rows="4" data-testid="edit-analysis" />
          </label>
          <label class="replay-edit-wide">
            <span>最终处理方案 <em>{{ editDraft.finalSolution.length }}/500</em></span>
            <textarea v-model="editDraft.finalSolution" maxlength="500" rows="4" data-testid="edit-solution" />
          </label>
          <label class="replay-edit-wide">
            <span>备注 <em>{{ editDraft.remark.length }}/500</em></span>
            <textarea v-model="editDraft.remark" maxlength="500" rows="3" data-testid="edit-remark" />
          </label>
          <label class="replay-edit-wide">
            <span>需协同人</span>
            <div class="replay-user-picker">
              <input v-model="editDraft.cooperationPersonDisplay" type="search" placeholder="姓名或账号" data-testid="edit-collaborator" @input="searchEditUsers" />
              <div v-if="editUserOptions.length" class="replay-user-options">
                <button v-for="user in editUserOptions" :key="user.username" type="button" @click="selectEditUser(user)">{{ user.displayName }}</button>
              </div>
            </div>
          </label>
        </div>
        <p v-if="editError" class="replay-edit-error">{{ editError }}</p>
        <footer>
          <button class="replay-button" type="button" :disabled="savingId === editIssue?.id" @click="closeEdit">取消</button>
          <button class="replay-button replay-button-primary" type="button" data-testid="save-edit" :disabled="savingId === editIssue?.id" @click="saveEdit"><Save :size="15" aria-hidden="true" />{{ savingId === editIssue?.id ? '保存中…' : '保存' }}</button>
        </footer>
      </section>
    </div>

    <div v-if="trackingOpen" class="replay-drawer-mask" @click.self="closeTracking">
      <aside class="replay-tracking-drawer" role="dialog" aria-modal="true" aria-labelledby="replay-tracking-title" data-testid="tracking-drawer">
        <header>
          <div><h3 id="replay-tracking-title">问题跟踪路径</h3><p>{{ trackingIssue?.issue_key }}</p></div>
          <button class="replay-icon-button" type="button" title="关闭问题跟踪路径" aria-label="关闭问题跟踪路径" @click="closeTracking"><X :size="16" aria-hidden="true" /></button>
        </header>
        <p v-if="trackingLoading" class="replay-drawer-state">正在加载…</p>
        <p v-else-if="trackingError" class="replay-drawer-state replay-error">{{ trackingError }}</p>
        <ol v-else class="replay-timeline">
          <li v-for="event in trackingEvents" :key="event.id">
            <div class="replay-timeline-marker" aria-hidden="true"></div>
            <article>
              <div class="replay-event-heading"><strong>{{ event.operationType }}</strong><time>{{ event.operationAt }}</time></div>
              <p>{{ event.operatorRealName || event.operatorUsername || '系统' }}<span v-if="event.operatorUsername">（{{ event.operatorUsername }}）</span></p>
              <dl>
                <div><dt>当前状态</dt><dd>{{ display(event.issueStatus) }}</dd></div>
                <div><dt>问题类型</dt><dd>{{ display(event.issueType) }}</dd></div>
                <div><dt>初步问题分析</dt><dd>{{ display(event.initialAnalysis) }}</dd></div>
                <div><dt>最终处理方案</dt><dd>{{ display(event.finalSolution) }}</dd></div>
                <div><dt>需协同人</dt><dd>{{ collaboratorDisplay(event) }}</dd></div>
                <div><dt>备注</dt><dd>{{ display(event.remark) }}</dd></div>
              </dl>
              <details><summary>完整快照</summary><pre>{{ formatSnapshots(event) }}</pre></details>
            </article>
          </li>
          <li v-if="trackingEvents.length === 0" class="replay-drawer-state">暂无跟踪记录</li>
        </ol>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ChevronLeft, ChevronRight, HelpCircle, History as HistoryIcon, Menu, Pencil, RotateCcw, Save, Search, Upload, X } from 'lucide-vue-next'
import { getReplayIssueOptions, getReplayIssueStats, getReplayIssueTracking, importReplayIssues, listReplayIssues, searchReplayIssueUsers, updateReplayIssue } from '../../api/replayIssues.js'

defineEmits(['toggleNavigation'])

const columns = [
  ['domain', '领域', '120px'], ['is_sandbox', '是否沙箱', '90px'], ['batch_no', '批次', '220px'],
  ['transaction_code', '交易码', '100px'], ['transaction_name', '交易名称', '180px'], ['issue_level', '问题级别', '100px'],
  ['registered_date', '登记日期', '108px'], ['import_date', '导入时间', '108px'], ['field_name', '字段名', '120px'], ['issue_description', '问题描述', '220px'],
  ['transaction_owner', '交易负责人', '112px'], ['operation', '操作', '176px'], ['issue_status', '问题状态', '132px'], ['issue_type', '问题类型', '132px'], ['initial_analysis', '初步问题分析', '220px'],
  ['final_solution', '最终处理方案', '220px'], ['cooperation_person_username', '需协同人', '180px'], ['remark', '备注', '160px'], ['serial_no', '流水号', '160px'], ['defect_repair_date', '缺陷修复日期', '120px'],
  ['affected_transaction_count', '该问题出现在的交易笔数', '176px'], ['issue_id', 'issue_id', '112px'],
  ['issue_key', 'issue_key', '180px'], ['historical_occurrence_count', '历史出现次数', '128px'],
  ['first_occurrence_date', '首次出现日期', '180px'], ['last_occurrence_date', '上次出现日期', '180px'],
].map(([key, label, width]) => ({ key, label, width }))

const manualStatuses = ['分析中', '延后修复', '修复待验证']
const issueTypes = ['迁移问题', '防腐问题', '代码问题', '新核心下线', '其他问题']
const manualDisplayKeys = new Set(['issue_status', 'issue_type', 'initial_analysis', 'final_solution', 'cooperation_person_username', 'remark'])
const filters = reactive({ groupName: '', issueLevel: '', issueType: '', issueStatus: '', sandbox: '', transactionOwner: '', cooperationPerson: '', keyword: '' })
const allStatuses = ['打开', '分析中', '延后修复', '修复待验证', '重新打开', '已修复']
const options = reactive({ groups: [], issueLevels: [], issueTypes, issueStatuses: allStatuses })
const stats = reactive({ total: 0, openTotal: 0, processingTotal: 0, pendingVerificationTotal: 0, fixedTotal: 0, groupCounts: {}, importedAt: '' })
const summaryGroups = ['公共组', '存款组', '贷款组', '结算组']
const summaryCards = [
  { key: 'total', label: '问题总数（全部状态）', valueKey: 'total' },
  { key: 'open', label: '问题打开总数', valueKey: 'openTotal' },
  { key: 'processing', label: '问题处理中总数', valueKey: 'processingTotal' },
  { key: 'pendingVerification', label: '问题待验证总数', valueKey: 'pendingVerificationTotal' },
  { key: 'fixed', label: '问题已修复总数', valueKey: 'fixedTotal' },
]
const items = ref([])
const total = ref(0)
const page = ref(0)
const pageSize = ref(50)
const loading = ref(false)
const error = ref('')

const importOpen = ref(false)
const importFile = ref(null)
const importToken = ref('')
const importing = ref(false)
const importComplete = ref(false)
const importMessage = ref('')
const importError = ref(false)
const savingId = ref(null)
const editOpen = ref(false)
const editIssue = ref(null)
const editDraft = reactive({ issueStatus: '', issueType: '', initialAnalysis: '', finalSolution: '', cooperationPersonUsername: '', cooperationPersonDisplay: '', remark: '' })
const editUserOptions = ref([])
const editError = ref('')
const trackingOpen = ref(false)
const trackingIssue = ref(null)
const trackingEvents = ref([])
const trackingLoading = ref(false)
const trackingError = ref('')

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function display(value) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function displayColumn(key, value) {
  if (key === 'is_sandbox') return value === true || value === 1 || value === 'true' || value === '1' ? '是' : '否'
  return display(value)
}

function summaryValue(card) {
  return stats[card.valueKey] ?? 0
}

function groupSummary(card, group) {
  return stats.groupCounts?.[group]?.[card.key] ?? 0
}

function requestParams() {
  return {
    groupName: filters.groupName || undefined,
    issueLevel: filters.issueLevel || undefined,
    issueType: filters.issueType || undefined,
    ...(filters.issueStatus ? { issueStatus: filters.issueStatus } : {}),
    sandbox: filters.sandbox === '' ? undefined : filters.sandbox === 'true',
    ...(filters.transactionOwner ? { transactionOwner: filters.transactionOwner } : {}),
    ...(filters.cooperationPerson ? { cooperationPerson: filters.cooperationPerson } : {}),
    keyword: filters.keyword || undefined,
    limit: pageSize.value,
    offset: page.value * pageSize.value,
  }
}

function openEdit(row) {
  editIssue.value = row
  Object.assign(editDraft, {
    issueStatus: manualStatuses.includes(row.issue_status) ? row.issue_status : '',
    issueType: row.issue_type || '',
    initialAnalysis: row.initial_analysis || '',
    finalSolution: row.final_solution || '',
    cooperationPersonUsername: row.cooperation_person_username || '',
    cooperationPersonDisplay: row.cooperation_person_real_name && row.cooperation_person_username
      ? `${row.cooperation_person_real_name}(${row.cooperation_person_username})` : '',
    remark: row.remark || '',
  })
  editUserOptions.value = []
  editError.value = ''
  editOpen.value = true
}

function closeEdit() {
  if (savingId.value === editIssue.value?.id) return
  editOpen.value = false
  editIssue.value = null
  editUserOptions.value = []
  editError.value = ''
}

async function searchEditUsers() {
  editDraft.cooperationPersonUsername = ''
  if (!editDraft.cooperationPersonDisplay.trim()) {
    editUserOptions.value = []
    return
  }
  try {
    editUserOptions.value = await searchReplayIssueUsers(editDraft.cooperationPersonDisplay.trim())
  } catch (cause) {
    editUserOptions.value = []
    editError.value = `协同人检索失败：${cause?.message || cause}`
  }
}

function selectEditUser(user) {
  editDraft.cooperationPersonUsername = user.username
  editDraft.cooperationPersonDisplay = user.displayName
  editUserOptions.value = []
}

async function saveEdit() {
  if (!editIssue.value) return
  if (editDraft.initialAnalysis.length > 500 || editDraft.finalSolution.length > 500 || editDraft.remark.length > 500) {
    editError.value = '初步问题分析、最终处理方案和备注不能超过500个字符'
    return
  }
  const viewport = document.querySelector('[data-testid="table-viewport"]')
  const scrollLeft = viewport?.scrollLeft || 0
  const savedPage = page.value
  const savedIssueId = editIssue.value.id
  savingId.value = editIssue.value.id
  editError.value = ''
  try {
    await updateReplayIssue(editIssue.value.id, {
      issueStatus: editDraft.issueStatus,
      issueType: editDraft.issueType,
      initialAnalysis: editDraft.initialAnalysis,
      finalSolution: editDraft.finalSolution,
      cooperationPersonUsername: editDraft.cooperationPersonUsername || null,
      remark: editDraft.remark,
    })
    const refreshed = await loadList({ preserveOnError: true })
    if (!refreshed || page.value !== savedPage) {
      editError.value = '保存成功，但列表刷新失败，请重试刷新当前页'
      return
    }
    await loadMetadata()
    if (!items.value.some((item) => item.id === savedIssueId)) {
      editError.value = '保存成功，但当前问题未出现在刷新结果中，请重新查询'
      return
    }
    savingId.value = null
    closeEdit()
    await nextTick()
    if (viewport) viewport.scrollLeft = scrollLeft
  } catch (cause) {
    editError.value = `保存失败：${cause?.message || cause}`
  } finally {
    savingId.value = null
  }
}

async function openTracking(row) {
  trackingIssue.value = row
  trackingOpen.value = true
  trackingLoading.value = true
  trackingError.value = ''
  try {
    trackingEvents.value = await getReplayIssueTracking(row.id) || []
  } catch (cause) {
    trackingEvents.value = []
    trackingError.value = `加载跟踪失败：${cause?.message || cause}`
  } finally {
    trackingLoading.value = false
  }
}

function closeTracking() {
  trackingOpen.value = false
}

function collaboratorDisplay(event) {
  if (!event.cooperationPersonUsername) return '-'
  return event.cooperationPersonRealName ? `${event.cooperationPersonRealName}(${event.cooperationPersonUsername})` : event.cooperationPersonUsername
}

function formatSnapshots(event) {
  return [event.beforeSnapshot ? `操作前：${event.beforeSnapshot}` : '操作前：-', event.afterSnapshot ? `操作后：${event.afterSnapshot}` : '操作后：-', event.incomingSnapshot ? `导入输入：${event.incomingSnapshot}` : '导入输入：-'].join('\n')
}

async function loadList({ preserveOnError = false } = {}) {
  loading.value = true
  error.value = ''
  try {
    const result = await listReplayIssues(requestParams())
    items.value = result.items || []
    total.value = result.total || 0
  } catch (cause) {
    if (!preserveOnError) {
      items.value = []
      total.value = 0
    }
    error.value = `加载失败：${cause?.message || cause}`
    return false
  } finally {
    loading.value = false
  }
  return true
}

async function loadMetadata() {
  try {
    const [nextOptions, nextStats] = await Promise.all([getReplayIssueOptions(), getReplayIssueStats()])
    Object.assign(options, nextOptions || {})
    options.issueStatuses = allStatuses
    Object.assign(stats, nextStats || {})
  } catch (cause) {
    error.value = `加载筛选项失败：${cause?.message || cause}`
  }
}

function query() {
  page.value = 0
  return loadList()
}

function resetFilters() {
  Object.assign(filters, { groupName: '', issueLevel: '', issueType: '', issueStatus: '', sandbox: '', transactionOwner: '', cooperationPerson: '', keyword: '' })
  return query()
}

function goPrevious() {
  if (page.value === 0 || loading.value) return
  page.value -= 1
  return loadList()
}

function goNext() {
  if (page.value + 1 >= pageCount.value || loading.value) return
  page.value += 1
  return loadList()
}

function changePageSize(event) {
  pageSize.value = Number(event.target.value)
  page.value = 0
  return loadList()
}

function openImport() {
  importOpen.value = true
  importFile.value = null
  importToken.value = ''
  importComplete.value = false
  importMessage.value = ''
  importError.value = false
}

function closeImport() {
  if (!importing.value) importOpen.value = false
}

function selectImportFile(event) {
  importFile.value = event.target.files?.[0] || null
  importComplete.value = false
  importMessage.value = ''
  importError.value = false
}

async function submitImport() {
  if (!importFile.value || importing.value || importComplete.value) return
  importing.value = true
  importMessage.value = ''
  importError.value = false
  try {
    const result = await importReplayIssues(importFile.value, importToken.value)
    importComplete.value = true
    importMessage.value = `导入完成：${result.inputRows ?? result.totalRows ?? 0} 条；新增 ${result.createdRows ?? 0} 条；更新 ${result.updatedRows ?? 0} 条；忽略 ${result.ignoredRows ?? 0} 条`
    page.value = 0
    await Promise.all([loadList(), loadMetadata()])
  } catch (cause) {
    importError.value = true
    importMessage.value = `导入失败：${cause?.message || cause}`
  } finally {
    importing.value = false
  }
}

onMounted(() => {
  loadList()
  loadMetadata()
})
</script>

<style scoped>
.replay-page {
  --replay-teal: #0d6672;
  --replay-row-alt: #eef7fb;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--text-primary, #1f2937);
  background: var(--bg-page, #f0f2f7);
}

.replay-toolbar, .replay-filters, .replay-pager { flex: 0 0 auto; }

.replay-toolbar {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  background: var(--bg-card, #fff);
  border-bottom: 1px solid var(--border, #e8edf5);
}

.replay-toolbar h2, .replay-import-modal h3 { margin: 0; font-size: 18px; line-height: 24px; font-weight: 650; }
.replay-toolbar p, .replay-import-modal p { margin: 3px 0 0; color: var(--text-muted, #6b7280); font-size: 12px; line-height: 18px; }
.replay-toolbar-title { min-width: 0; display: flex; align-items: center; gap: 10px; }
.replay-icon-button.replay-mobile-navigation { display: none; }

.replay-summary {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  padding: 12px 20px 0;
}

.replay-summary-card {
  min-height: 62px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 8px 12px;
  border: 1px solid var(--border, #e8edf5);
  background: var(--bg-card, #fff);
  border-radius: 6px;
  position: relative;
  outline: none;
}
.replay-summary-card span { color: var(--text-muted, #6b7280); font-size: 12px; line-height: 16px; }
.replay-summary-card strong { font-size: 20px; line-height: 26px; font-variant-numeric: tabular-nums; }
.replay-summary-tooltip { position: absolute; z-index: 12; top: calc(100% + 6px); left: 0; min-width: 180px; display: none; padding: 9px 10px; border: 1px solid var(--border, #d7dee8); border-radius: 5px; background: var(--bg-card, #fff); box-shadow: 0 8px 20px rgba(13, 20, 36, .16); }
.replay-summary-card:hover .replay-summary-tooltip, .replay-summary-card:focus-visible .replay-summary-tooltip { display: grid; gap: 5px; }
.replay-summary-tooltip div { display: flex; justify-content: space-between; gap: 18px; font-size: 12px; line-height: 16px; }
.replay-summary-tooltip b { color: var(--text-primary, #1f2937); font-variant-numeric: tabular-nums; }

.replay-filters {
  display: flex;
  align-items: end;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 20px;
  background: var(--bg-card, #fff);
  border-bottom: 1px solid var(--border, #e8edf5);
}

.replay-filters label, .replay-import-modal label { display: grid; gap: 4px; color: var(--text-secondary, #374151); font-size: 12px; line-height: 16px; }
.replay-filters select { width: 126px; }
.replay-keyword-field input { width: min(250px, 35vw); }
.replay-filters select, .replay-filters input, .replay-import-modal input {
  height: 32px;
  border: 1px solid var(--border, #e8edf5);
  border-radius: 4px;
  padding: 0 9px;
  color: var(--text-primary, #1f2937);
  background: var(--bg-input, #fff);
  font: inherit;
}

.replay-button, .replay-icon-button {
  min-height: 32px;
  border: 1px solid var(--border, #e8edf5);
  border-radius: 4px;
  color: var(--text-secondary, #374151);
  background: var(--bg-action-btn, #fff);
  cursor: pointer;
  font: inherit;
}
.replay-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 11px; white-space: nowrap; }
.replay-button-compact { min-height: 27px; padding: 0 7px; font-size: 11px; }
.replay-icon-button { width: 32px; min-width: 32px; display: inline-grid; place-items: center; padding: 0; }
.replay-button-primary { border-color: var(--text-active, #3b5adb); color: var(--btn-primary-text, #fff); background: var(--text-active, #3b5adb); }
.replay-button:disabled, .replay-icon-button:disabled { cursor: not-allowed; opacity: .48; }

.replay-table-viewport { min-height: 0; flex: 1 1 auto; overflow: auto; padding: 0 20px; }
.replay-table { min-width: 3000px; table-layout: fixed; border-collapse: separate; border-spacing: 0; width: 100%; font-size: 12px; }
.replay-table th > span, .replay-table th > svg { vertical-align: middle; }
.replay-table th > svg { margin-left: 4px; opacity: .82; }
.replay-table thead th { position: sticky; top: 0; z-index: 2; background: var(--replay-teal); color: #fff; }
.replay-table th, .replay-table td { height: 34px; padding: 7px 10px; text-align: left; vertical-align: middle; border-right: 1px solid var(--border, #e8edf5); border-bottom: 1px solid var(--border, #e8edf5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.replay-table th:first-child, .replay-table td:first-child { border-left: 1px solid var(--border, #e8edf5); }
.replay-table tbody tr:nth-child(even) td { background: var(--replay-row-alt); }
.replay-table tbody tr:nth-child(odd) td { background: var(--bg-card, #fff); }
.replay-state { text-align: center !important; color: var(--text-muted, #6b7280); }
.replay-error { color: var(--c-error-code-text, #cf1124); }
.replay-manual-value { color: #cf1124; white-space: pre-wrap; overflow-wrap: anywhere; }
.replay-operation-buttons { display: flex; align-items: center; gap: 5px; }
.replay-table td select, .replay-table td input, .replay-table td textarea { width: 100%; min-width: 0; border: 1px solid var(--border, #e8edf5); border-radius: 3px; padding: 4px 5px; color: inherit; background: var(--bg-input, #fff); font: inherit; }
.replay-table td textarea { min-height: 42px; resize: vertical; line-height: 16px; }
.replay-inline-control, .replay-issue-key-cell { display: flex; align-items: center; gap: 5px; min-width: 0; }
.replay-inline-control select { flex: 1 1 auto; }
.replay-save { flex: 0 0 auto; width: 26px; min-width: 26px; height: 26px; min-height: 26px; }
.replay-status-text { overflow: hidden; text-overflow: ellipsis; }
.replay-user-picker { position: relative; }
.replay-user-options { position: absolute; z-index: 8; top: calc(100% + 2px); left: 0; right: 0; display: grid; max-height: 180px; overflow: auto; border: 1px solid var(--border, #e8edf5); background: var(--bg-card, #fff); box-shadow: 0 8px 18px rgba(13, 20, 36, .16); }
.replay-user-options button { border: 0; padding: 7px 8px; text-align: left; color: var(--text-primary, #1f2937); background: transparent; font: inherit; cursor: pointer; }
.replay-user-options button:hover { background: var(--replay-row-alt); }
.replay-drawer-mask { position: fixed; z-index: 1100; inset: 0; background: rgba(13, 20, 36, .28); }
.replay-tracking-drawer { position: absolute; top: 0; right: 0; width: min(470px, 100%); height: 100%; display: flex; flex-direction: column; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: -12px 0 32px rgba(13, 20, 36, .2); }
.replay-tracking-drawer > header { flex: 0 0 auto; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--border, #e8edf5); }
.replay-tracking-drawer h3 { margin: 0; font-size: 17px; line-height: 24px; }
.replay-tracking-drawer header p { margin: 3px 0 0; color: var(--text-muted, #6b7280); font-size: 12px; overflow-wrap: anywhere; }
.replay-timeline { min-height: 0; flex: 1 1 auto; overflow: auto; margin: 0; padding: 18px 20px 28px 34px; list-style: none; }
.replay-timeline > li { position: relative; padding: 0 0 16px 18px; border-left: 1px solid var(--border, #d7dee8); }
.replay-timeline-marker { position: absolute; top: 2px; left: -5px; width: 9px; height: 9px; border: 2px solid var(--text-active, #3b5adb); border-radius: 50%; background: var(--bg-card, #fff); }
.replay-timeline article { border: 1px solid var(--border, #e8edf5); border-radius: 5px; padding: 10px; background: var(--bg-card, #fff); }
.replay-event-heading { display: flex; justify-content: space-between; gap: 8px; }
.replay-event-heading time { color: var(--text-muted, #6b7280); font-size: 11px; white-space: nowrap; }
.replay-timeline article > p { margin: 5px 0 9px; color: var(--text-secondary, #374151); font-size: 12px; }
.replay-timeline dl { display: grid; gap: 6px; margin: 0; }
.replay-timeline dl div { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 8px; }
.replay-timeline dt { color: var(--text-muted, #6b7280); }
.replay-timeline dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.replay-timeline details { margin-top: 9px; }
.replay-timeline summary { color: var(--text-active, #3b5adb); cursor: pointer; }
.replay-timeline pre { max-height: 180px; overflow: auto; margin: 7px 0 0; padding: 7px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-secondary, #374151); background: var(--bg-page, #f0f2f7); font: 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace; }
.replay-drawer-state { padding: 20px; color: var(--text-muted, #6b7280); }

.replay-pager { min-height: 52px; display: flex; align-items: center; justify-content: flex-end; gap: 14px; padding: 10px 20px; border-top: 1px solid var(--border, #e8edf5); background: var(--bg-card, #fff); color: var(--text-muted, #6b7280); font-size: 12px; }
.replay-pager label { display: inline-flex; align-items: center; gap: 6px; }
.replay-pager select { width: 66px; height: 30px; border: 1px solid var(--border, #e8edf5); border-radius: 4px; color: var(--text-primary, #1f2937); background: var(--bg-input, #fff); }
.replay-page-actions { display: flex; gap: 6px; }

.replay-modal-mask { position: fixed; z-index: 30; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(13, 20, 36, .42); }
.replay-import-modal { width: min(460px, 100%); display: grid; gap: 16px; padding: 20px; border: 1px solid var(--border, #e8edf5); border-radius: 6px; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: 0 16px 42px rgba(13, 20, 36, .24); }
.replay-edit-modal { width: min(680px, 100%); display: grid; gap: 16px; padding: 20px; border: 1px solid var(--border, #e8edf5); border-radius: 6px; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: 0 16px 42px rgba(13, 20, 36, .24); }
.replay-edit-modal header, .replay-edit-modal footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.replay-edit-modal footer { justify-content: flex-end; }
.replay-edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px 14px; }
.replay-edit-grid label { display: grid; gap: 5px; color: var(--text-secondary, #374151); font-size: 12px; line-height: 16px; }
.replay-edit-grid label > span { display: flex; justify-content: space-between; gap: 8px; }
.replay-edit-grid em { color: var(--text-muted, #6b7280); font-style: normal; font-variant-numeric: tabular-nums; }
.replay-edit-wide { grid-column: 1 / -1; }
.replay-edit-grid select, .replay-edit-grid input, .replay-edit-grid textarea { width: 100%; border: 1px solid var(--border, #e8edf5); border-radius: 4px; padding: 7px 9px; color: var(--text-primary, #1f2937); background: var(--bg-input, #fff); font: inherit; }
.replay-edit-grid textarea { min-height: 78px; resize: vertical; line-height: 18px; }
.replay-edit-error { margin: 0; color: var(--c-error-code-text, #cf1124); font-size: 12px; }
.replay-import-modal header, .replay-import-modal footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.replay-import-modal footer { justify-content: flex-end; }
.replay-file-field small { color: var(--text-muted, #6b7280); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.replay-import-message { margin: 0 !important; padding: 8px 10px; border: 1px solid var(--border, #e8edf5); border-radius: 4px; background: var(--bg-badge, #f0f2f5); color: var(--text-secondary, #374151) !important; }
.replay-import-message.is-error { color: var(--c-error-code-text, #cf1124) !important; }

[data-theme="dark"] .replay-page { --replay-teal: #145c67; --replay-row-alt: rgba(126, 184, 255, .07); }

@media (max-width: 768px) {
  .replay-toolbar, .replay-filters, .replay-pager { padding-left: 12px; padding-right: 12px; }
  .replay-toolbar { min-height: auto; align-items: flex-start; flex-wrap: wrap; }
  .replay-toolbar-title { width: 100%; }
  .replay-icon-button.replay-mobile-navigation { flex: 0 0 auto; display: inline-grid; }
  .replay-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); padding-left: 12px; padding-right: 12px; }
  .replay-summary-card { padding-left: 8px; padding-right: 8px; }
  .replay-filters label { flex: 1 1 126px; }
  .replay-filters select { width: 100%; }
  .replay-keyword-field, .replay-keyword-field input { width: 100% !important; }
  .replay-edit-grid { grid-template-columns: 1fr; }
  .replay-edit-wide { grid-column: auto; }
  .replay-table-viewport { padding-left: 12px; padding-right: 12px; }
  .replay-pager { justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .replay-tracking-drawer { width: 100%; }
}
</style>
