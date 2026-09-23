<template>
  <section class="replay-page replay-config-page" aria-label="忽略清单" data-testid="replay-ignore-list">
    <header class="replay-toolbar">
      <div class="replay-toolbar-title">
        <div>
          <h2>忽略清单</h2>
          <p>无条件忽略 / 有条件忽略 / 错误码忽略 / 排序字段</p>
        </div>
      </div>
    </header>

    <nav class="replay-tabs" role="tablist" aria-label="忽略清单分类">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        role="tab"
        class="replay-tab"
        :class="{ active: activeTab === tab.key }"
        :aria-selected="activeTab === tab.key ? 'true' : 'false'"
        :data-testid="`tab-${tab.key}`"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <form class="replay-filters" @submit.prevent="search">
      <div class="replay-filter-group">
        <span class="replay-filter-group-label">内部核心交易码</span>
        <input v-model.trim="internalTransactionCode" class="replay-control" data-testid="internal-transaction-code" type="search" placeholder="精确匹配" />
      </div>
      <div class="replay-filter-group">
        <span class="replay-filter-group-label">领域</span>
        <select v-model="filters.domain" class="replay-control" data-testid="filter-domain">
          <option value="">全部</option>
          <option v-for="domain in domainOptions" :key="domain" :value="domain">{{ domain }}</option>
        </select>
      </div>
      <div class="replay-filter-group">
        <span class="replay-filter-group-label">配置字段</span>
        <template v-for="filter in schema.filters" :key="filter.key">
          <select v-if="filter.kind === 'flag'" v-model="filters[filter.key]" class="replay-control" :data-testid="`filter-${filter.key}`">
            <option value="">全部</option>
            <option value="1">普通字段</option>
            <option value="2">对象或数组</option>
          </select>
          <select v-else-if="filter.kind === 'review'" v-model="filters[filter.key]" class="replay-control" :data-testid="`filter-${filter.key}`">
            <option value="">全部</option>
            <option value="0">未审核</option>
            <option value="1">已审核</option>
          </select>
          <input v-else v-model.trim="filters[filter.key]" class="replay-control" :data-testid="`filter-${filter.key}`" type="search" :placeholder="filter.label" />
        </template>
        <label class="replay-checkbox">
          <input v-model="reviewableByMe" type="checkbox" data-testid="filter-reviewable-by-me" />
          <span>仅我负责</span>
        </label>
      </div>
      <div class="replay-filter-actions">
        <button class="replay-button replay-button-primary" type="submit" data-testid="search">查询</button>
        <button class="replay-button" type="button" data-testid="reset" @click="reset">重置</button>
        <button class="replay-button replay-button-primary" type="button" data-testid="batch-review" :disabled="!selectedIds.length || loading" @click="batchReview">
          批量审核{{ selectedIds.length ? `（${selectedIds.length}）` : '' }}
        </button>
        <button class="replay-button replay-button-danger" type="button" data-testid="batch-delete" :disabled="!selectedIds.length || loading" @click="batchDelete">
          批量删除{{ selectedIds.length ? `（${selectedIds.length}）` : '' }}
        </button>
        <button class="replay-button replay-button-primary" type="button" data-testid="create-config" @click="openCreate">新增</button>
      </div>
    </form>

    <div class="replay-table-viewport">
      <table class="replay-table">
        <thead>
          <tr>
            <th class="replay-select-column"><input type="checkbox" :checked="allSelected" :disabled="!items.length" data-testid="select-all" @change="toggleAll" /></th>
            <th v-for="column in schema.columns" :key="column.key">{{ column.label }}</th>
            <th class="replay-operation-column">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td class="replay-select-column"><input type="checkbox" :value="row.id" v-model="selectedIds" :data-testid="`select-${row.id}`" /></td>
            <td v-for="column in schema.columns" :key="column.key" :class="{ 'replay-cell-long': column.long }" :title="displayValue(column, row)">
              {{ displayValue(column, row) }}
            </td>
            <td class="replay-operation-column">
              <div class="replay-operation-buttons">
                <button
                  class="replay-button replay-button-compact"
                  type="button"
                  :data-testid="`review-${row.id}`"
                  :disabled="!row.canReview"
                  :title="row.reviewDisabledReason || '审核通过'"
                  @click="reviewRow(row)"
                >审核</button>
                <button class="replay-button replay-button-compact" type="button" :data-testid="`edit-${row.id}`" @click="openEdit(row)">修改</button>
                <button class="replay-button replay-button-compact" type="button" :data-testid="`delete-${row.id}`" @click="removeRow(row)">删除</button>
                <button class="replay-button replay-button-compact" type="button" :data-testid="`history-${row.id}`" @click="openHistory(row)">历史</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td :colspan="schema.columns.length + 2" class="replay-state">暂无配置数据</td>
          </tr>
          <tr v-else-if="loading">
            <td :colspan="schema.columns.length + 2" class="replay-state">加载中...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="replay-pager">
      <span>共 {{ total }} 条，第 {{ page + 1 }} / {{ pageCount }} 页</span>
      <label class="replay-page-size">每页
        <select v-model.number="pageSize" data-testid="page-size" @change="changePageSize">
          <option :value="10">10</option>
          <option :value="30">30</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select> 条
      </label>
      <div class="replay-page-actions">
        <button class="replay-button replay-button-compact" type="button" data-testid="previous-page" :disabled="page === 0 || loading" @click="goPrevious">上一页</button>
        <button class="replay-button replay-button-compact" type="button" data-testid="next-page" :disabled="page + 1 >= pageCount || loading" @click="goNext">下一页</button>
      </div>
    </footer>

    <div v-if="editOpen" class="replay-modal-mask">
      <section class="replay-edit-modal" role="dialog" aria-modal="true" :aria-label="editTitle">
        <header>
          <h3>{{ editTitle }}</h3>
          <button class="replay-icon-button" type="button" data-testid="close-edit" :disabled="saving" @click="closeEdit">关闭</button>
        </header>
        <form class="replay-edit-grid" @submit.prevent="submitForm">
          <template v-for="(row, index) in formRows" :key="index">
            <p v-if="isMultiCreate" class="replay-field-wide replay-create-row-title">第 {{ index + 1 }} 条</p>
            <label v-for="field in activeForm" :key="field.key" class="replay-field" :class="{ 'replay-field-wide': field.kind === 'textarea' }">
              <span>{{ field.label }}<em v-if="field.required"> *</em></span>
              <select v-if="field.kind === 'select'" v-model.number="row[field.key]" :data-testid="fieldTestId(field, index)">
                <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <textarea v-else-if="field.kind === 'textarea'" v-model="row[field.key]" :data-testid="fieldTestId(field, index)" rows="3" :maxlength="field.maxlength || undefined" :placeholder="field.placeholder || ''"></textarea>
              <input v-else v-model.trim="row[field.key]" :data-testid="fieldTestId(field, index)" type="text" :maxlength="field.maxlength || undefined" :placeholder="field.placeholder || ''" />
            </label>
          </template>
          <p v-if="createHint" class="replay-field-wide replay-hint">{{ createHint }}</p>
          <div v-if="formError" class="replay-message replay-error replay-field-wide" data-testid="form-error">{{ formError }}</div>
          <div class="replay-form-actions replay-field-wide">
            <button class="replay-button" type="button" :disabled="saving" @click="closeEdit">取消</button>
            <button class="replay-button replay-button-primary" type="submit" data-testid="submit-config" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
          </div>
        </form>
      </section>
    </div>

    <div v-if="historyOpen" class="replay-drawer-mask" @click.self="closeHistory">
      <aside class="replay-history-drawer" role="dialog" aria-modal="true" aria-label="操作历史" data-testid="history-drawer">
        <header>
          <h3>操作历史</h3>
          <button class="replay-icon-button" type="button" data-testid="close-history" @click="closeHistory">关闭</button>
        </header>
        <p v-if="historyLoading" class="replay-state">加载中...</p>
        <p v-else-if="!historyItems.length" class="replay-state">暂无操作记录</p>
        <ol v-else class="replay-history-list">
          <li v-for="operation in historyItems" :key="operation.id" class="replay-history-item">
            <div class="replay-history-head">
              <span class="replay-history-type" :class="`replay-history-${operation.operationType.toLowerCase()}`">{{ operationLabel(operation.operationType) }}</span>
              <span>{{ operation.operatorRealName || operation.operatorUsername || '-' }}</span>
              <time>{{ formatTime(operation.createdAt) }}</time>
            </div>
            <table class="replay-history-changes">
              <thead><tr><th>字段</th><th>原值</th><th>新值</th></tr></thead>
              <tbody>
                <tr v-for="change in operation.changes" :key="change.field">
                  <td>{{ change.label }}</td>
                  <td>{{ formatChangeValue(change, change.oldValue) }}</td>
                  <td>{{ formatChangeValue(change, change.newValue) }}</td>
                </tr>
              </tbody>
            </table>
          </li>
        </ol>
      </aside>
    </div>

    <div v-if="confirmOpen" class="replay-modal-mask" @click.self="!confirming && closeConfirm()">
      <section class="replay-confirm-modal" role="alertdialog" aria-modal="true" aria-label="操作确认" data-testid="confirm-modal">
        <p class="replay-confirm-text">{{ confirmText }}</p>
        <dl v-if="confirmDetails.length" class="replay-confirm-detail">
          <div v-for="item in confirmDetails" :key="item.label" class="replay-confirm-row">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
        <div class="replay-confirm-actions">
          <button class="replay-button" type="button" data-testid="confirm-cancel" :disabled="confirming" @click="closeConfirm">取消</button>
          <button class="replay-button" :class="confirmDanger ? 'replay-button-danger' : 'replay-button-primary'" type="button" data-testid="confirm-ok" :disabled="confirming" @click="confirmAction">{{ confirming ? '处理中...' : '确定' }}</button>
        </div>
      </section>
    </div>

    <transition name="replay-toast">
      <div v-if="toast.visible" class="replay-toast" :class="`replay-toast-${toast.kind}`" role="status" data-testid="toast">
        {{ toast.text }}
      </div>
    </transition>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import {
  batchCreateReplayConfigs,
  batchDeleteReplayConfigs,
  batchReviewReplayConfigs,
  createReplayConfig,
  deleteReplayConfig,
  listReplayConfigDomains,
  listReplayConfigOperations,
  listReplayConfigs,
  reviewReplayConfig,
  updateReplayConfig,
} from '../../api/replayConfigs.js'

const REVIEW_COLUMNS = [
  { key: 'oldTransactionCode', label: '老核心交易码' },
  { key: 'developer', label: '开发人员' },
  { key: 'bankOwner', label: '行方负责人' },
  { key: 'reviewStatus', label: '审核状态', display: 'review' },
]

const SERVICE_CODE_PATTERN = /^[0-9A-Za-z]+&(sop|soap|bzjson)$/

const TABS = [
  { key: 'unconditional-ignores', label: '无条件忽略' },
  { key: 'conditional-ignores', label: '有条件忽略' },
  { key: 'error-code-ignores', label: '错误码忽略' },
  { key: 'sort-fields', label: '排序字段' },
]

const SORT_CREATE_FORM = [
  { key: 'tranCode', label: '4 位交易码', kind: 'text', required: true, placeholder: '如 6208' },
  { key: 'oldSortField', label: '老核心排序字段', kind: 'text', required: true, placeholder: 'A.B 或 A(B,C)' },
  { key: 'newSortField', label: '新核心排序字段', kind: 'text', required: true, placeholder: 'A.B 或 A(B,C)' },
  { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
]

const SCHEMAS = {
  'unconditional-ignores': {
    title: '无条件忽略',
    filters: [
      { key: 'tranCode', label: '服务码', kind: 'text' },
      { key: 'fieldName', label: '忽略字段', kind: 'text' },
      { key: 'reviewStatus', label: '审核状态', kind: 'review' },
    ],
    columns: [
      { key: 'domain', label: '领域' },
      { key: 'tranCode', label: '服务码' },
      { key: 'fieldName', label: '忽略字段' },
      { key: 'ignoreReason', label: '忽略原因', long: true },
      ...REVIEW_COLUMNS,
    ],
    confirmFields: [
      { key: 'tranCode', label: '服务码' },
      { key: 'fieldName', label: '忽略字段' },
    ],
    form: [
      { key: 'tranCode', label: '服务码', kind: 'serviceCode', required: true, placeholder: '如 S120034071CorpInfoQryTrdCrclr&sop' },
      { key: 'fieldName', label: '忽略字段', kind: 'text', required: true },
      { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
    ],
  },
  'conditional-ignores': {
    title: '有条件忽略',
    filters: [
      { key: 'origTrcd', label: '服务码', kind: 'text' },
      { key: 'fieldRmoveName', label: '忽略字段', kind: 'text' },
      { key: 'fieldFileFlag', label: '字段标识', kind: 'flag' },
      { key: 'reviewStatus', label: '审核状态', kind: 'review' },
    ],
    columns: [
      { key: 'domain', label: '领域' },
      { key: 'origTrcd', label: '服务码' },
      { key: 'fieldRmoveName', label: '忽略字段' },
      { key: 'fieldFileIndx', label: '字段索引' },
      { key: 'fieldFileFlag', label: '字段标识', display: 'flag' },
      { key: 'origFieldCond', label: '主系统字段忽略条件', long: true },
      { key: 'destFieldCond', label: '备系统字段忽略条件', long: true },
      { key: 'ignoreReason', label: '忽略原因', long: true },
      ...REVIEW_COLUMNS,
    ],
    confirmFields: [
      { key: 'origTrcd', label: '服务码' },
      { key: 'fieldRmoveName', label: '忽略字段' },
    ],
    form: [
      { key: 'origTrcd', label: '服务码', kind: 'serviceCode', required: true },
      { key: 'fieldRmoveName', label: '忽略字段', kind: 'text', required: true },
      { key: 'fieldFileFlag', label: '字段标识', kind: 'select', required: true, options: [
        { value: 1, label: '普通字段' },
        { value: 2, label: '对象或数组' },
      ] },
      { key: 'origFieldCond', label: '主系统字段忽略条件', kind: 'textarea' },
      { key: 'destFieldCond', label: '备系统字段忽略条件', kind: 'textarea' },
      { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
    ],
  },
  'error-code-ignores': {
    title: '错误码忽略',
    filters: [
      { key: 'serviceCode', label: '服务码', kind: 'text' },
      { key: 'oldRespCode', label: '老核心错误码', kind: 'text' },
      { key: 'newRespCode', label: '新核心错误码', kind: 'text' },
      { key: 'reviewStatus', label: '审核状态', kind: 'review' },
    ],
    columns: [
      { key: 'domain', label: '领域' },
      { key: 'serviceCode', label: '服务码' },
      { key: 'oldRespCode', label: '老核心错误码' },
      { key: 'newRespCode', label: '新核心错误码' },
      { key: 'ignoreReason', label: '忽略原因', long: true },
      ...REVIEW_COLUMNS,
    ],
    confirmFields: [
      { key: 'serviceCode', label: '服务码' },
      { key: 'oldRespCode', label: '老核心错误码' },
      { key: 'newRespCode', label: '新核心错误码' },
    ],
    form: [
      { key: 'serviceCode', label: '服务码', kind: 'serviceCode', required: true },
      { key: 'oldRespCode', label: '老核心错误码', kind: 'text' },
      { key: 'newRespCode', label: '新核心错误码', kind: 'text' },
      { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
    ],
    validate: (draft) => {
      if (!draft.oldRespCode && !draft.newRespCode) {
        return '老核心错误码与新核心错误码不能同时为空'
      }
      return ''
    },
  },
  'sort-fields': {
    title: '排序字段',
    filters: [
      { key: 'origTrcd', label: '服务码', kind: 'text' },
      { key: 'origArryName', label: '对象/数组名称', kind: 'text' },
      { key: 'origFieldName', label: '排序字段', kind: 'text' },
      { key: 'reviewStatus', label: '审核状态', kind: 'review' },
    ],
    columns: [
      { key: 'domain', label: '领域' },
      { key: 'origTrcd', label: '服务码' },
      { key: 'origArryName', label: '对象/数组名称' },
      { key: 'origFieldName', label: '排序字段' },
      { key: 'ignoreReason', label: '忽略原因', long: true },
      ...REVIEW_COLUMNS,
    ],
    confirmFields: [
      { key: 'origTrcd', label: '服务码' },
      { key: 'origArryName', label: '对象/数组名称' },
      { key: 'origFieldName', label: '排序字段' },
    ],
    form: [
      { key: 'origTrcd', label: '服务码', kind: 'serviceCode', required: true },
      { key: 'origArryName', label: '对象/数组名称', kind: 'text', required: true },
      { key: 'origFieldName', label: '排序字段', kind: 'text', required: true },
      { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
    ],
  },
}

const activeTab = ref(TABS[0].key)
const schema = computed(() => SCHEMAS[activeTab.value])
const isSortTab = computed(() => activeTab.value === 'sort-fields')

const items = ref([])
const total = ref(0)
const page = ref(0)
const pageSize = ref(10)
const loading = ref(false)
const internalTransactionCode = ref('')
const reviewableByMe = ref(false)
const filters = reactive({})
const selectedIds = ref([])
const domainOptions = ref([])

const editOpen = ref(false)
const editingRow = ref(null)
const saving = ref(false)
const formError = ref('')
const draft = reactive({})
const createRows = ref([])

const historyOpen = ref(false)
const historyItems = ref([])
const historyLoading = ref(false)

const confirmOpen = ref(false)
const confirmText = ref('')
const confirmDetails = ref([])
const confirming = ref(false)
const confirmDanger = ref(false)
let confirmHandler = null

const toast = reactive({ visible: false, kind: 'success', text: '' })
let toastTimer = null

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const allSelected = computed(() => items.value.length > 0 && items.value.every((row) => selectedIds.value.includes(row.id)))
const editTitle = computed(() => `${editingRow.value ? '修改' : '新增'}${schema.value.title}`)
const isSortCreate = computed(() => isSortTab.value && !editingRow.value)
const isMultiCreate = computed(() => !isSortTab.value && !editingRow.value)
const activeForm = computed(() => (isSortCreate.value ? SORT_CREATE_FORM : schema.value.form))
const formRows = computed(() => (isMultiCreate.value ? createRows.value : [draft]))
const createHint = computed(() => {
  if (isSortCreate.value) {
    return '保存后按映射生成 3 条：&sop 用老核心排序字段，&soap 与 &bzjson 用新核心排序字段。'
  }
  if (isMultiCreate.value) {
    return '最多可一次新增 3 条，每条独立填写，可只填其中部分；任一条重复则整批不写入。'
  }
  return ''
})

function fieldTestId(field, index) {
  return isMultiCreate.value ? `form-${index}-${field.key}` : `form-${field.key}`
}

function showToast(text, kind = 'success') {
  toast.text = text
  toast.kind = kind
  toast.visible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.visible = false }, kind === 'error' ? 5000 : 3000)
}

function displayValue(column, row) {
  const value = row[column.key]
  if (column.display === 'flag') {
    if (value === 1) return '普通字段'
    if (value === 2) return '对象或数组'
  }
  if (column.display === 'review') {
    if (value === 1) return '已审核'
    if (value === 0) return '未审核'
  }
  return value === null || value === undefined || value === '' ? '-' : value
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}

function operationLabel(type) {
  return { CREATE: '新增', UPDATE: '修改', DELETE: '删除', REVIEW: '审核' }[type] || type
}

function formatChangeValue(change, value) {
  if (value === null || value === undefined || value === '') return '-'
  if (change.field === 'review_status') {
    if (String(value) === '1') return '已审核'
    if (String(value) === '0') return '未审核'
  }
  return value
}

function resetFilters() {
  for (const key of Object.keys(filters)) delete filters[key]
  for (const filter of schema.value.filters) {
    filters[filter.key] = ''
  }
  filters.domain = ''
  internalTransactionCode.value = ''
  reviewableByMe.value = false
}

function requestParams() {
  const params = {
    limit: pageSize.value,
    offset: page.value * pageSize.value,
  }
  if (internalTransactionCode.value) params.internalTransactionCode = internalTransactionCode.value
  if (filters.domain) params.domain = filters.domain
  if (reviewableByMe.value) params.reviewableByMe = 'true'
  for (const filter of schema.value.filters) {
    const value = filters[filter.key]
    if (value !== undefined && value !== null && value !== '') params[filter.key] = value
  }
  return params
}

async function load() {
  loading.value = true
  try {
    const result = await listReplayConfigs(activeTab.value, requestParams())
    items.value = result?.items || []
    total.value = result?.total || 0
    selectedIds.value = []
  } catch (cause) {
    items.value = []
    total.value = 0
    showToast(`加载失败：${cause?.message || cause}`, 'error')
  } finally {
    loading.value = false
  }
}

async function loadDomains() {
  try {
    domainOptions.value = (await listReplayConfigDomains()) || []
  } catch {
    domainOptions.value = []
  }
}

function switchTab(key) {
  if (activeTab.value === key) return
  activeTab.value = key
  page.value = 0
  selectedIds.value = []
  resetFilters()
  return load()
}

function search() {
  page.value = 0
  return load()
}

function reset() {
  resetFilters()
  page.value = 0
  return load()
}

function goPrevious() {
  if (page.value === 0 || loading.value) return
  page.value -= 1
  return load()
}

function goNext() {
  if (page.value + 1 >= pageCount.value || loading.value) return
  page.value += 1
  return load()
}

function changePageSize() {
  page.value = 0
  return load()
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : items.value.map((row) => row.id)
}

function resetDraft() {
  for (const key of Object.keys(draft)) delete draft[key]
  for (const field of activeForm.value) {
    draft[field.key] = field.kind === 'select' ? field.options[0].value : ''
  }
}

function resetCreateRows() {
  createRows.value = [0, 1, 2].map(() => {
    const row = {}
    for (const field of schema.value.form) {
      row[field.key] = field.kind === 'select' ? field.options[0].value : ''
    }
    return row
  })
}

function openCreate() {
  editingRow.value = null
  formError.value = ''
  if (isSortTab.value) {
    resetDraft()
  } else {
    resetCreateRows()
  }
  editOpen.value = true
}

function openEdit(row) {
  editingRow.value = row
  formError.value = ''
  resetDraft()
  for (const field of schema.value.form) {
    draft[field.key] = row[field.key] ?? (field.kind === 'select' ? field.options[0].value : '')
  }
  editOpen.value = true
}

function closeEdit() {
  if (saving.value) return
  editOpen.value = false
}

function isValidSortField(value) {
  const text = String(value ?? '').trim()
  if (/^[^(]+\([^)]+\)$/.test(text)) return true
  const dot = text.indexOf('.')
  return dot > 0 && dot < text.length - 1
}

function validateFields(row, form) {
  for (const field of form) {
    const value = row[field.key]
    if (field.required && (value === undefined || value === null || String(value).trim() === '')) {
      return `${field.label}不能为空`
    }
    if (field.kind === 'serviceCode' && !SERVICE_CODE_PATTERN.test(String(value).trim())) {
      return `${field.label}格式不正确，应为 <服务码>&sop|&soap|&bzjson`
    }
  }
  return ''
}

function validateDraft() {
  const base = validateFields(draft, activeForm.value)
  if (base) return base
  if (isSortCreate.value) {
    if (!isValidSortField(draft.oldSortField)) return '老核心排序字段格式不正确，应为 A.B 或 A(B,C)'
    if (!isValidSortField(draft.newSortField)) return '新核心排序字段格式不正确，应为 A.B 或 A(B,C)'
    return ''
  }
  return schema.value.validate ? schema.value.validate(draft) : ''
}

function toPayload(row, form) {
  const payload = {}
  for (const field of form) {
    const value = row[field.key]
    payload[field.key] = field.kind !== 'textarea' && typeof value === 'string' ? value.trim() : value
  }
  return payload
}

async function submitBatchCreate() {
  const serviceKey = (schema.value.form.find((field) => field.kind === 'serviceCode') || {}).key
  const items = []
  for (let index = 0; index < createRows.value.length; index += 1) {
    const row = createRows.value[index]
    const serviceCode = serviceKey ? String(row[serviceKey] ?? '').trim() : ''
    if (!serviceCode) {
      const hasOther = schema.value.form.some((field) => field.key !== serviceKey
        && field.kind !== 'select'
        && String(row[field.key] ?? '').trim() !== '')
      if (hasOther) {
        formError.value = `第 ${index + 1} 条：请先填写服务码`
        return
      }
      continue
    }
    const extra = validateFields(row, schema.value.form)
      || (schema.value.validate ? schema.value.validate(row) : '')
    if (extra) {
      formError.value = `第 ${index + 1} 条：${extra}`
      return
    }
    items.push(toPayload(row, schema.value.form))
  }
  if (!items.length) {
    formError.value = '请至少填写一条'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    const created = await batchCreateReplayConfigs(activeTab.value, items)
    showToast(`新增成功（${created?.length ?? items.length} 条）`)
    editOpen.value = false
    await load()
  } catch (cause) {
    formError.value = cause?.message || '新增失败'
    showToast(cause?.message || '新增失败', 'error')
  } finally {
    saving.value = false
  }
}

async function submitForm() {
  if (saving.value) return
  if (isMultiCreate.value) {
    return submitBatchCreate()
  }
  const validation = validateDraft()
  if (validation) {
    formError.value = validation
    return
  }
  saving.value = true
  formError.value = ''
  try {
    const payload = {}
    for (const field of activeForm.value) {
      const value = draft[field.key]
      payload[field.key] = field.kind !== 'textarea' && typeof value === 'string' ? value.trim() : value
    }
    if (editingRow.value) {
      payload.version = editingRow.value.version
      await updateReplayConfig(activeTab.value, editingRow.value.id, payload)
      showToast('修改成功')
    } else {
      const created = await createReplayConfig(activeTab.value, payload)
      showToast(Array.isArray(created) ? `新增成功（${created.length} 条）` : '新增成功')
    }
    editOpen.value = false
    await load()
  } catch (cause) {
    formError.value = cause?.message || '保存失败'
    showToast(cause?.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

function openConfirm(text, details, handler, danger = false) {
  confirmText.value = text
  confirmDetails.value = details || []
  confirmHandler = handler
  confirmDanger.value = danger === true
  confirmOpen.value = true
}

function resetConfirm() {
  confirmOpen.value = false
  confirmDetails.value = []
  confirmDanger.value = false
  confirmHandler = null
}

function closeConfirm() {
  if (confirming.value) return
  resetConfirm()
}

async function confirmAction() {
  if (!confirmHandler || confirming.value) return
  const handler = confirmHandler
  confirming.value = true
  try {
    await handler()
  } finally {
    confirming.value = false
    resetConfirm()
  }
}

function rowConfirmDetails(row) {
  return (schema.value.confirmFields || []).map((field) => ({
    label: field.label,
    value: row[field.key] === null || row[field.key] === undefined || row[field.key] === '' ? '-' : row[field.key],
  }))
}

function reviewRow(row) {
  if (!row.canReview) return
  openConfirm('确认审核通过该条配置？', rowConfirmDetails(row), async () => {
    try {
      await reviewReplayConfig(activeTab.value, row.id, row.version)
      showToast('审核通过')
      await load()
    } catch (cause) {
      showToast(`审核失败：${cause?.message || cause}`, 'error')
    }
  })
}

function removeRow(row) {
  openConfirm(`确认删除该条${schema.value.title}配置？此操作不可恢复。`, rowConfirmDetails(row), async () => {
    try {
      await deleteReplayConfig(activeTab.value, row.id, row.version)
      showToast('删除成功')
      await load()
    } catch (cause) {
      showToast(`删除失败：${cause?.message || cause}`, 'error')
    }
  }, true)
}

function batchReview() {
  if (!selectedIds.value.length) return
  const byId = new Map(items.value.map((row) => [row.id, row]))
  const selectedRows = selectedIds.value.map((id) => byId.get(id)).filter(Boolean)
  const reviewableCount = selectedRows.filter((row) => row.canReview).length
  const details = [
    { label: '已选', value: `${selectedRows.length} 条` },
    { label: '可审核', value: `${reviewableCount} 条` },
    { label: '将跳过', value: `${selectedRows.length - reviewableCount} 条` },
  ]
  openConfirm('确认批量审核选中的配置？', details, async () => {
    if (!selectedRows.length) return
    const payload = selectedRows.map((row) => ({ id: row.id, version: row.version }))
    try {
      const result = await batchReviewReplayConfigs(activeTab.value, payload)
      showToast(`审核通过 ${result?.approvedCount ?? 0} 条，跳过 ${result?.skippedCount ?? 0} 条`)
      await load()
    } catch (cause) {
      showToast(`批量审核失败：${cause?.message || cause}`, 'error')
    }
  })
}

function batchDelete() {
  if (!selectedIds.value.length) return
  const byId = new Map(items.value.map((row) => [row.id, row]))
  const selectedRows = selectedIds.value.map((id) => byId.get(id)).filter(Boolean)
  const payload = selectedRows.map((row) => ({ id: row.id, version: row.version }))
  const details = [{ label: '已选', value: `${selectedRows.length} 条` }]
  openConfirm(`确认删除已勾选的 ${selectedIds.value.length} 条记录？此操作不可恢复。`, details, async () => {
    if (!payload.length) return
    try {
      const result = await batchDeleteReplayConfigs(activeTab.value, payload)
      showToast(`删除成功：${result?.deletedCount ?? payload.length} 条`)
      await load()
    } catch (cause) {
      showToast(`批量删除失败：${cause?.message || cause}`, 'error')
    }
  }, true)
}

async function openHistory(row) {
  historyOpen.value = true
  historyItems.value = []
  historyLoading.value = true
  try {
    const result = await listReplayConfigOperations(activeTab.value, row.id, { limit: 100, offset: 0 })
    historyItems.value = result?.items || []
  } catch (cause) {
    showToast(`加载历史失败：${cause?.message || cause}`, 'error')
  } finally {
    historyLoading.value = false
  }
}

function closeHistory() {
  historyOpen.value = false
}

onMounted(() => {
  resetFilters()
  loadDomains()
  return load()
})

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<style scoped>
.replay-page{height:100%;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:var(--bg-primary,#f5f7fa);color:var(--text-primary,#1f2937)}
.replay-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px;padding:12px 20px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border,#e5e7eb)}
.replay-toolbar h2{margin:0;font-size:16px}.replay-toolbar-title p{margin:3px 0 0;color:var(--text-muted,#6b7280);font-size:12px}
.replay-toolbar-actions,.replay-page-actions,.replay-form-actions{display:flex;gap:8px;align-items:center}
.replay-button,.replay-icon-button{min-height:34px;padding:0 12px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit;cursor:pointer;font-size:13px}
.replay-button:disabled{opacity:.55;cursor:not-allowed}
.replay-button-primary{background:#0b70db;border-color:#0b70db;color:#fff}
.replay-button-danger{background:#d92d20;border-color:#d92d20;color:#fff}
.replay-button-danger:disabled{background:#fda29b;border-color:#fda29b;color:#fff;opacity:1}
.replay-button-compact{min-height:28px;padding:0 8px;font-size:12px}
.replay-tabs{display:flex;gap:4px;padding:0 20px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border,#e5e7eb)}
.replay-tab{min-height:40px;padding:0 14px;border:none;border-bottom:2px solid transparent;background:transparent;color:var(--text-muted,#6b7280);cursor:pointer;font-size:13px}
.replay-tab.active{border-bottom-color:#0b70db;color:#0b70db;font-weight:600}
.replay-filters{display:flex;flex-wrap:wrap;align-items:center;gap:16px;padding:12px 20px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border,#e5e7eb)}
.replay-filter-group{display:flex;align-items:center;gap:8px}
.replay-filter-group-label{font-size:13px;font-weight:600;color:var(--text-primary,#1f2937);white-space:nowrap}
.replay-filter-actions{display:flex;align-items:center;gap:8px;margin-left:auto}
.replay-control{height:34px;min-width:150px;padding:0 10px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit;font-size:13px;box-sizing:border-box}
.replay-checkbox{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-primary,#1f2937);white-space:nowrap}
.replay-checkbox input{width:15px;height:15px;accent-color:#0b70db}
.replay-field{display:grid;gap:5px;font-size:12px;min-width:150px}
.replay-field em{color:#d92d20;font-style:normal}
.replay-field input,.replay-field select,.replay-field textarea{height:34px;padding:0 10px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit;font-size:13px;box-sizing:border-box}
.replay-field textarea{height:auto;padding:8px 10px;resize:vertical;font-family:inherit}
.replay-hint{margin:0;color:var(--text-muted,#6b7280);font-size:12px}
.replay-create-row-title{margin:0;padding-top:8px;border-top:1px dashed var(--border,#e5e7eb);font-size:13px;font-weight:600;color:var(--text-primary,#1f2937)}
.replay-create-row-title:first-child{padding-top:0;border-top:none}
.replay-message{margin:0;padding:8px 12px;border-radius:6px;background:#eef7ee;color:#24713d;font-size:13px}
.replay-error{background:#fff1f0;color:#b42318}
.replay-table-viewport{flex:1 1 auto;min-height:0;overflow:auto;padding:12px 20px}
.replay-table{width:100%;border-collapse:collapse;background:var(--bg-card,#fff);table-layout:fixed}
.replay-table th,.replay-table td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--border,#e5e7eb);font-size:13px;word-break:break-all;vertical-align:top}
.replay-table thead th{position:sticky;top:0;z-index:2;background:#0d6672;color:#fff}
.replay-select-column{width:44px}
.replay-operation-column{width:262px;white-space:nowrap}
.replay-operation-buttons{display:flex;gap:5px}
.replay-cell-long{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.replay-state{text-align:center;color:var(--text-muted,#6b7280);padding:28px 0}
.replay-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 20px;background:var(--bg-card,#fff);border-top:1px solid var(--border,#e5e7eb)}
.replay-page-size{display:flex;align-items:center;gap:6px;font-size:12px}
.replay-page-size select{height:32px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit}
.replay-modal-mask,.replay-drawer-mask{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.38)}
.replay-modal-mask{display:grid;place-items:center}
.replay-edit-modal{width:min(680px,calc(100vw - 32px));max-height:86vh;overflow:auto;display:grid;gap:16px;padding:20px;background:var(--bg-card,#fff);border-radius:8px}
.replay-edit-modal header,.replay-history-drawer header{display:flex;align-items:center;justify-content:space-between}
.replay-edit-modal h3,.replay-history-drawer h3{margin:0;font-size:15px}
.replay-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.replay-field-wide{grid-column:1 / -1}
.replay-form-actions{justify-content:flex-end}
.replay-drawer-mask{display:flex;justify-content:flex-end}
.replay-history-drawer{display:flex;flex-direction:column;gap:12px;width:min(520px,100%);height:100%;padding:20px;background:var(--bg-card,#fff);overflow:auto}
.replay-history-list{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.replay-history-item{border:1px solid var(--border,#e5e7eb);border-radius:6px;padding:10px 12px}
.replay-history-head{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-muted,#6b7280);margin-bottom:8px}
.replay-history-type{padding:1px 8px;border-radius:10px;background:#eef2ff;color:#3538cd}
.replay-history-delete{background:#fff1f0;color:#b42318}
.replay-history-update{background:#fff7e6;color:#b54708}
.replay-history-changes{width:100%;border-collapse:collapse}
.replay-history-changes th,.replay-history-changes td{padding:6px 8px;border-bottom:1px solid var(--border,#eef0f3);font-size:12px;text-align:left;word-break:break-all}
.replay-confirm-modal{width:min(360px,calc(100vw - 32px));display:grid;gap:18px;padding:20px;background:var(--bg-card,#fff);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.2)}
.replay-confirm-text{margin:0;font-size:14px;color:var(--text-primary,#1f2937)}
.replay-confirm-detail{margin:0;display:grid;gap:6px}
.replay-confirm-row{display:grid;grid-template-columns:88px 1fr;gap:8px;font-size:13px}
.replay-confirm-row dt{color:var(--text-muted,#6b7280)}
.replay-confirm-row dd{margin:0;color:var(--text-primary,#1f2937);word-break:break-all}
.replay-confirm-actions{display:flex;justify-content:flex-end;gap:8px}
.replay-toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2000;min-width:180px;max-width:70vw;padding:10px 16px;border-radius:6px;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.18);background:#24713d;color:#fff}
.replay-toast-error{background:#b42318}
.replay-toast-enter-active,.replay-toast-leave-active{transition:opacity .2s ease}
.replay-toast-enter-from,.replay-toast-leave-to{opacity:0}
@media (max-width:768px){
  .replay-toolbar{align-items:flex-start;flex-wrap:wrap}
  .replay-toolbar-actions{width:100%;justify-content:flex-end}
  .replay-tabs{overflow-x:auto}
  .replay-edit-grid{grid-template-columns:1fr}
  .replay-history-drawer{width:100%}
}
</style>
