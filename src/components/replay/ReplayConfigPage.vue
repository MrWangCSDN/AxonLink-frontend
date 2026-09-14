<template>
  <section class="replay-page replay-config-page" :aria-label="schema.title" :data-testid="`replay-config-${type}`">
    <header class="replay-toolbar">
      <div class="replay-toolbar-title">
        <div>
          <h2>{{ schema.title }}</h2>
          <p>{{ schema.subtitle }}</p>
        </div>
      </div>
      <div class="replay-toolbar-actions">
        <button class="replay-button" type="button" data-testid="batch-delete" :disabled="!selectedIds.length || loading" @click="batchDelete">
          批量删除{{ selectedIds.length ? `（${selectedIds.length}）` : '' }}
        </button>
        <button class="replay-button replay-button-primary" type="button" data-testid="create-config" @click="openCreate">新增</button>
      </div>
    </header>

    <form class="replay-filters" @submit.prevent="search">
      <div class="replay-filter-group">
        <span class="replay-filter-group-label">内部核心交易码</span>
        <label class="replay-field">
          <input v-model.trim="internalTransactionCode" data-testid="internal-transaction-code" type="search" placeholder="精确匹配" />
        </label>
      </div>
      <div class="replay-filter-group">
        <span class="replay-filter-group-label">配置字段</span>
        <label v-for="filter in schema.filters" :key="filter.key" class="replay-field">
          <span>{{ filter.label }}</span>
          <select v-if="filter.kind === 'flag'" v-model="filters[filter.key]" :data-testid="`filter-${filter.key}`">
            <option value="">全部</option>
            <option value="1">普通字段</option>
            <option value="2">对象或数组</option>
          </select>
          <input v-else v-model.trim="filters[filter.key]" :data-testid="`filter-${filter.key}`" type="search" :placeholder="filter.label" />
        </label>
      </div>
      <div class="replay-filter-actions">
        <button class="replay-button replay-button-primary" type="submit" data-testid="search">查询</button>
        <button class="replay-button" type="button" data-testid="reset" @click="reset">重置</button>
      </div>
    </form>

    <div v-if="error" class="replay-message replay-error" data-testid="error-message">{{ error }}</div>
    <div v-else-if="notice" class="replay-message" data-testid="notice-message">{{ notice }}</div>

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

    <div v-if="editOpen" class="replay-modal-mask" @click.self="!saving && closeEdit()">
      <section class="replay-edit-modal" role="dialog" aria-modal="true" :aria-label="editTitle">
        <header>
          <h3>{{ editTitle }}</h3>
          <button class="replay-icon-button" type="button" data-testid="close-edit" :disabled="saving" @click="closeEdit">关闭</button>
        </header>
        <form class="replay-edit-grid" @submit.prevent="submitForm">
          <label v-for="field in schema.form" :key="field.key" class="replay-field" :class="{ 'replay-field-wide': field.kind === 'textarea' }">
            <span>{{ field.label }}<em v-if="field.required"> *</em></span>
            <select v-if="field.kind === 'select'" v-model.number="draft[field.key]" :data-testid="`form-${field.key}`">
              <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <textarea v-else-if="field.kind === 'textarea'" v-model="draft[field.key]" :data-testid="`form-${field.key}`" rows="3" :placeholder="field.placeholder || ''"></textarea>
            <input v-else v-model.trim="draft[field.key]" :data-testid="`form-${field.key}`" type="text" :placeholder="field.placeholder || ''" />
          </label>
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
        <p v-if="historyError" class="replay-message replay-error">{{ historyError }}</p>
        <p v-else-if="historyLoading" class="replay-state">加载中...</p>
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
                  <td>{{ change.oldValue ?? '-' }}</td>
                  <td>{{ change.newValue ?? '-' }}</td>
                </tr>
              </tbody>
            </table>
          </li>
        </ol>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  batchDeleteReplayConfigs,
  createReplayConfig,
  deleteReplayConfig,
  listReplayConfigOperations,
  listReplayConfigs,
  updateReplayConfig,
} from '../../api/replayConfigs.js'

const SERVICE_CODE_PATTERN = /^[0-9A-Za-z]+&(sop|soap|bzjson)$/

const SCHEMAS = {
  'unconditional-ignores': {
    title: '无条件忽略',
    subtitle: '按服务码忽略指定字段',
    filters: [
      { key: 'tranCode', label: '服务码', kind: 'text' },
      { key: 'fieldName', label: '忽略字段', kind: 'text' },
    ],
    columns: [
      { key: 'tranCode', label: '服务码' },
      { key: 'fieldName', label: '忽略字段' },
    ],
    form: [
      { key: 'tranCode', label: '服务码', kind: 'serviceCode', required: true, placeholder: '如 S120034071CorpInfoQryTrdCrclr&sop' },
      { key: 'fieldName', label: '忽略字段', kind: 'text', required: true },
    ],
  },
  'conditional-ignores': {
    title: '有条件忽略',
    subtitle: '按服务码与主备条件忽略字段，字段索引由后端分配',
    filters: [
      { key: 'origTrcd', label: '服务码', kind: 'text' },
      { key: 'fieldRmoveName', label: '忽略字段', kind: 'text' },
      { key: 'fieldFileFlag', label: '字段标识', kind: 'flag' },
    ],
    columns: [
      { key: 'origTrcd', label: '服务码' },
      { key: 'fieldRmoveName', label: '忽略字段' },
      { key: 'fieldFileIndx', label: '字段索引' },
      { key: 'fieldFileFlag', label: '字段标识', display: 'flag' },
      { key: 'origFieldCond', label: '主系统字段忽略条件', long: true },
      { key: 'destFieldCond', label: '备系统字段忽略条件', long: true },
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
    ],
  },
  'error-code-ignores': {
    title: '错误码忽略',
    subtitle: '按服务码忽略老/新核心错误码',
    filters: [
      { key: 'serviceCode', label: '服务码', kind: 'text' },
      { key: 'oldRespCode', label: '老核心错误码', kind: 'text' },
      { key: 'newRespCode', label: '新核心错误码', kind: 'text' },
    ],
    columns: [
      { key: 'serviceCode', label: '服务码' },
      { key: 'oldRespCode', label: '老核心错误码' },
      { key: 'newRespCode', label: '新核心错误码' },
    ],
    form: [
      { key: 'serviceCode', label: '服务码', kind: 'serviceCode', required: true },
      { key: 'oldRespCode', label: '老核心错误码', kind: 'text' },
      { key: 'newRespCode', label: '新核心错误码', kind: 'text' },
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
    subtitle: '按对象或数组节点配置排序字段',
    filters: [
      { key: 'origTrcd', label: '服务码', kind: 'text' },
      { key: 'origArryName', label: '对象/数组名称', kind: 'text' },
      { key: 'origFieldName', label: '排序字段', kind: 'text' },
    ],
    columns: [
      { key: 'origTrcd', label: '服务码' },
      { key: 'origArryName', label: '对象/数组名称' },
      { key: 'origFieldName', label: '排序字段' },
    ],
    form: [
      { key: 'origTrcd', label: '服务码', kind: 'serviceCode', required: true },
      { key: 'origArryName', label: '对象/数组名称', kind: 'text', required: true },
      { key: 'origFieldName', label: '排序字段', kind: 'text', required: true },
    ],
  },
}

const props = defineProps({
  type: { type: String, required: true },
})

const schema = computed(() => SCHEMAS[props.type])

const items = ref([])
const total = ref(0)
const page = ref(0)
const pageSize = ref(30)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const internalTransactionCode = ref('')
const filters = reactive({})
for (const filter of schema.value.filters) {
  filters[filter.key] = ''
}
const selectedIds = ref([])

const editOpen = ref(false)
const editingRow = ref(null)
const saving = ref(false)
const formError = ref('')
const draft = reactive({})

const historyOpen = ref(false)
const historyRow = ref(null)
const historyItems = ref([])
const historyLoading = ref(false)
const historyError = ref('')

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const allSelected = computed(() => items.value.length > 0 && items.value.every((row) => selectedIds.value.includes(row.id)))
const editTitle = computed(() => `${editingRow.value ? '修改' : '新增'}${schema.value.title}`)

function displayValue(column, row) {
  const value = row[column.key]
  if (column.display === 'flag') {
    if (value === 1) return '普通字段'
    if (value === 2) return '对象或数组'
  }
  return value === null || value === undefined || value === '' ? '-' : value
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}

function operationLabel(type) {
  return { CREATE: '新增', UPDATE: '修改', DELETE: '删除' }[type] || type
}

function requestParams() {
  const params = {
    limit: pageSize.value,
    offset: page.value * pageSize.value,
  }
  if (internalTransactionCode.value) params.internalTransactionCode = internalTransactionCode.value
  for (const filter of schema.value.filters) {
    const value = filters[filter.key]
    if (value !== undefined && value !== null && value !== '') params[filter.key] = value
  }
  return params
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await listReplayConfigs(props.type, requestParams())
    items.value = result?.items || []
    total.value = result?.total || 0
    selectedIds.value = []
  } catch (cause) {
    items.value = []
    total.value = 0
    error.value = `加载失败：${cause?.message || cause}`
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 0
  return load()
}

function reset() {
  internalTransactionCode.value = ''
  for (const filter of schema.value.filters) filters[filter.key] = filter.kind === 'flag' ? '' : ''
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
  for (const field of schema.value.form) {
    draft[field.key] = field.kind === 'select' ? field.options[0].value : ''
  }
}

function openCreate() {
  editingRow.value = null
  formError.value = ''
  resetDraft()
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

function validateDraft() {
  for (const field of schema.value.form) {
    if (!field.required) continue
    const value = draft[field.key]
    if (value === undefined || value === null || value === '' || (typeof value === 'string' && !value.trim())) {
      return `${field.label}不能为空`
    }
    if (field.kind === 'serviceCode' && !SERVICE_CODE_PATTERN.test(String(value).trim())) {
      return `${field.label}格式不正确，应为 <服务码>&sop|&soap|&bzjson`
    }
  }
  return schema.value.validate ? schema.value.validate(draft) : ''
}

async function submitForm() {
  if (saving.value) return
  const validation = validateDraft()
  if (validation) {
    formError.value = validation
    return
  }
  saving.value = true
  formError.value = ''
  try {
    const payload = {}
    for (const field of schema.value.form) {
      const value = draft[field.key]
      payload[field.key] = field.kind !== 'textarea' && typeof value === 'string' ? value.trim() : value
    }
    if (editingRow.value) {
      payload.version = editingRow.value.version
      await updateReplayConfig(props.type, editingRow.value.id, payload)
      notice.value = '修改成功'
    } else {
      await createReplayConfig(props.type, payload)
      notice.value = '新增成功'
    }
    editOpen.value = false
    await load()
  } catch (cause) {
    formError.value = cause?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function removeRow(row) {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function'
      && !window.confirm(`确认删除该条${schema.value.title}配置？此操作不可恢复。`)) {
    return
  }
  error.value = ''
  notice.value = ''
  try {
    await deleteReplayConfig(props.type, row.id, row.version)
    notice.value = '删除成功'
    await load()
  } catch (cause) {
    error.value = `删除失败：${cause?.message || cause}`
  }
}

async function batchDelete() {
  if (!selectedIds.value.length) return
  if (typeof window !== 'undefined' && typeof window.confirm === 'function'
      && !window.confirm(`确认删除已勾选的 ${selectedIds.value.length} 条记录？此操作不可恢复。`)) {
    return
  }
  const byId = new Map(items.value.map((row) => [row.id, row]))
  const payload = selectedIds.value
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((row) => ({ id: row.id, version: row.version }))
  error.value = ''
  notice.value = ''
  try {
    const result = await batchDeleteReplayConfigs(props.type, payload)
    notice.value = `删除成功：${result?.deletedCount ?? payload.length} 条`
    await load()
  } catch (cause) {
    error.value = `批量删除失败：${cause?.message || cause}`
  }
}

async function openHistory(row) {
  historyRow.value = row
  historyOpen.value = true
  historyItems.value = []
  historyError.value = ''
  historyLoading.value = true
  try {
    const result = await listReplayConfigOperations(props.type, row.id, { limit: 100, offset: 0 })
    historyItems.value = result?.items || []
  } catch (cause) {
    historyError.value = `加载历史失败：${cause?.message || cause}`
  } finally {
    historyLoading.value = false
  }
}

function closeHistory() {
  historyOpen.value = false
}

onMounted(load)
</script>

<style scoped>
.replay-page{height:100%;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:var(--bg-primary,#f5f7fa);color:var(--text-primary,#1f2937)}
.replay-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px;padding:12px 20px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border,#e5e7eb)}
.replay-toolbar h2{margin:0;font-size:16px}.replay-toolbar-title p{margin:3px 0 0;color:var(--text-muted,#6b7280);font-size:12px}
.replay-toolbar-actions,.replay-page-actions,.replay-form-actions{display:flex;gap:8px;align-items:center}
.replay-button,.replay-icon-button{min-height:34px;padding:0 12px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit;cursor:pointer;font-size:13px}
.replay-button:disabled{opacity:.55;cursor:not-allowed}
.replay-button-primary{background:#0b70db;border-color:#0b70db;color:#fff}
.replay-button-compact{min-height:28px;padding:0 8px;font-size:12px}
.replay-filters{display:flex;flex-wrap:wrap;align-items:flex-end;gap:16px;padding:12px 20px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border,#e5e7eb)}
.replay-filter-group{display:flex;align-items:flex-end;gap:8px;padding:8px 12px;border:1px dashed var(--border,#d1d5db);border-radius:6px}
.replay-filter-group-label{font-size:12px;color:var(--text-muted,#6b7280);white-space:nowrap}
.replay-filter-actions{display:flex;gap:8px;margin-left:auto}
.replay-field{display:grid;gap:5px;font-size:12px;min-width:150px}
.replay-field em{color:#d92d20;font-style:normal}
.replay-field input,.replay-field select,.replay-field textarea{height:34px;padding:0 10px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit;font-size:13px;box-sizing:border-box}
.replay-field textarea{height:auto;padding:8px 10px;resize:vertical;font-family:inherit}
.replay-message{margin:8px 20px;padding:8px 12px;border-radius:6px;background:#eef7ee;color:#24713d;font-size:13px}
.replay-error{background:#fff1f0;color:#b42318}
.replay-table-viewport{flex:1 1 auto;min-height:0;overflow:auto;padding:12px 20px}
.replay-table{width:100%;border-collapse:collapse;background:var(--bg-card,#fff);table-layout:fixed}
.replay-table th,.replay-table td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--border,#e5e7eb);font-size:13px;word-break:break-all;vertical-align:top}
.replay-table thead th{position:sticky;top:0;z-index:2;background:#0d6672;color:#fff}
.replay-select-column{width:44px}
.replay-operation-column{width:210px;white-space:nowrap}
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
@media (max-width:768px){
  .replay-toolbar{align-items:flex-start;flex-wrap:wrap}
  .replay-toolbar-actions{width:100%;justify-content:flex-end}
  .replay-edit-grid{grid-template-columns:1fr}
  .replay-history-drawer{width:100%}
}
</style>
