<template>
  <div class="comparison-editor-backdrop" data-testid="comparison-editor-backdrop">
    <section class="comparison-editor" role="dialog" aria-modal="true" aria-labelledby="comparison-editor-title">
      <header class="editor-header">
        <div>
          <h3 id="comparison-editor-title" data-testid="editor-title">{{ isReregister ? '重新登记' : isEditing ? '编辑登记' : '新增登记' }}</h3>
          <p>选择 BASE 母库表并配置需要参与回放比对的字段</p>
        </div>
        <button type="button" class="icon-close" aria-label="关闭新增登记" @click="emit('close')">×</button>
      </header>

      <div class="editor-body">
        <section class="editor-block table-lookup">
          <div class="block-heading"><strong>1. 检索母库表</strong></div>
          <template v-if="!selectedTable">
            <div class="table-search">
              <input v-model="tableKeywordInput" data-testid="table-search-input" type="search" placeholder="输入至少 2 个字符，自动模糊查询表英文名或中文名" />
            </div>
            <div v-if="tableSearchExecuted" class="table-results">
              <button
                v-for="table in tableResults"
                :key="table.tableName"
                type="button"
                class="table-result"
                data-testid="table-search-result"
                @click="selectTable(table)"
              >
                <span><strong>{{ table.tableName }}</strong><small>{{ table.tableComment }}</small></span>
                <em :class="table.registrationStatus.toLowerCase()">{{ table.registrationStatus === 'ACTIVE' ? '已登记 · 进入编辑' : table.registrationStatus === 'DELETED' ? '已删除 · 重新登记' : '未登记' }}</em>
              </button>
              <p v-if="!tableResults.length" class="empty-result">未检索到匹配的母库表</p>
            </div>
          </template>
          <div v-else class="selected-table" data-testid="selected-table">
            <Database :size="18" />
            <span><strong>{{ selectedTable.tableName }}</strong><small>{{ selectedTable.tableComment }}</small></span>
            <em :class="isEditing ? 'active' : 'unregistered'">{{ isReregister ? '已删除 · 重新登记模式' : isEditing ? '已登记 · 编辑模式' : '未登记 · 新增模式' }}</em>
            <button v-if="!isEditing" type="button" class="text-button" @click="resetSelectedTable">重新选择表</button>
          </div>
        </section>

        <section class="editor-block fields-block">
          <div class="block-heading"><strong>2. 选择并排序比对字段</strong><span>{{ isTableMissingCleanup ? '母库表已删除' : `母库 ${allColumns.length} 个` }} · 已选择 {{ selectedColumns.length }} 个</span></div>
          <div v-if="isTableMissingCleanup" class="table-missing-cleanup-warning" data-testid="table-missing-cleanup-warning">
            <strong>母库中已找不到该表</strong>
            <span>当前只能查看历史登记并删除整表登记，不能修改字段或登记信息。</span>
          </div>
          <div v-if="isPrimaryKeyMissing" class="primary-key-missing-warning" data-testid="primary-key-missing-warning">
            <strong>该表没有主键，请联系 DBA 创建表主键</strong>
            <span>仅数据库 PRIMARY KEY 有效，创建完成后请重新打开登记页面。</span>
          </div>
          <div class="transfer-layout">
            <article class="field-panel">
              <header><strong>母库字段</strong><span>{{ availableColumns.length }} 个可选</span></header>
              <div class="field-tools">
                <input v-model.trim="fieldKeyword" data-testid="available-field-search" type="search" placeholder="单字段模糊搜索；顿号前精确匹配，最后一段模糊搜索" :disabled="isFieldMaintenanceDisabled" />
                <div class="field-filters">
                  <button type="button" data-testid="field-filter-all" :class="{ active: fieldFilter === 'ALL' }" :disabled="isFieldMaintenanceDisabled" @click="fieldFilter = 'ALL'">全部</button>
                  <button type="button" data-testid="field-filter-primary" :class="{ active: fieldFilter === 'PRIMARY_KEY' }" :disabled="isFieldMaintenanceDisabled" @click="fieldFilter = 'PRIMARY_KEY'">主键</button>
                  <button type="button" :class="{ active: fieldFilter === 'NON_PRIMARY_KEY' }" :disabled="isFieldMaintenanceDisabled" @click="fieldFilter = 'NON_PRIMARY_KEY'">非主键</button>
                </div>
              </div>
              <div class="selection-tools">
                <button type="button" data-testid="available-select-all" :disabled="isFieldMaintenanceDisabled" @click="selectAllAvailable">全选</button>
                <button type="button" data-testid="available-invert-selection" :disabled="isFieldMaintenanceDisabled" @click="invertAvailableSelection">反选</button>
                <span>已勾选 {{ availableSelection.length }} 个</span>
              </div>
              <div class="field-list-scroll" data-testid="available-fields">
                <label v-for="column in filteredAvailableColumns" :key="column.columnName" class="available-field-row" data-testid="available-field-row">
                  <input v-model="availableSelection" type="checkbox" :value="column.columnName" :data-testid="`available-field-${column.columnName}`" :disabled="isFieldMaintenanceDisabled" />
                  <span><strong>{{ column.columnName }}</strong><small>{{ column.columnComment || '暂无中文描述' }}</small></span>
                  <em>{{ column.dataType }}</em><b v-if="column.primaryKey" class="primary-key-marker">主键</b>
                </label>
                <div v-if="isTableMissingCleanup" class="field-panel-placeholder compact">母库已找不到该表，无可用字段</div>
                <div v-else-if="selectedTable && !filteredAvailableColumns.length" class="field-panel-placeholder compact">暂无可选字段</div>
                <div v-if="!selectedTable" class="field-panel-placeholder compact">请先选择母库表</div>
              </div>
            </article>
            <div class="transfer-actions"><button type="button" data-testid="move-fields-right" :disabled="isFieldMaintenanceDisabled || !availableSelection.length" @click="moveFieldsRight">添加 →</button><button type="button" data-testid="move-fields-left" :disabled="isFieldMaintenanceDisabled || !selectedSelection.length" @click="moveFieldsLeft">← 移除</button></div>
            <article class="field-panel" data-testid="selected-fields">
              <header><strong>已选比对字段</strong><span>{{ selectedColumns.length }} 个</span></header>
              <div class="field-tools selected-field-tools">
                <input v-model.trim="selectedFieldKeyword" data-testid="selected-field-search" type="search" placeholder="单字段模糊搜索；顿号前精确匹配，最后一段模糊搜索" :disabled="isFieldMaintenanceDisabled" />
                <div class="selection-actions">
                  <button type="button" data-testid="selected-select-all" :disabled="isFieldMaintenanceDisabled" @click="selectAllSelected">全选</button>
                  <button type="button" data-testid="selected-invert-selection" :disabled="isFieldMaintenanceDisabled" @click="invertSelectedSelection">反选</button>
                </div>
              </div>
              <div v-if="!isTableMissingCleanup && hasMissingSelectedColumns" class="missing-fields-warning" data-testid="missing-fields-warning">
                <strong>{{ missingSelectedColumns.length }} 个字段已从母库删除</strong>
                <span>请勾选失效字段并移除后再保存</span>
              </div>
              <div v-if="lastFieldMove" class="field-order-feedback" data-testid="field-order-feedback" aria-live="polite">
                <span>已将 {{ lastFieldMove.columnName }} 从第 {{ lastFieldMove.fromPosition }} 位移至第 {{ lastFieldMove.toPosition }} 位</span>
              </div>
              <TransitionGroup name="field-order" tag="ol" class="selected-preview field-list-scroll" data-testid="selected-fields-scroll">
                <li
                  v-for="entry in filteredSelectedColumns"
                  :key="entry.column.columnName"
                  :draggable="!isFieldMaintenanceDisabled && !entry.column.missingInBase"
                  data-testid="selected-field-row"
                  :data-missing-field="entry.column.missingInBase ? entry.column.columnName : undefined"
                  :class="{
                    'is-missing-in-base': entry.column.missingInBase,
                    'is-recently-moved': recentlyMovedFieldName === entry.column.columnName,
                  }"
                  @click="!isFieldMaintenanceDisabled && toggleSelectedColumn(entry.column.columnName)"
                  @dragstart="startDraggingField(entry)"
                  @dragover.prevent
                  @drop.stop="dropSelectedField(entry.index)"
                >
                  <input v-model="selectedSelection" type="checkbox" :value="entry.column.columnName" :disabled="isFieldMaintenanceDisabled || isProtectedPrimaryKey(entry.column)" :title="isProtectedPrimaryKey(entry.column) ? '母库主键，不可移除' : ''" @click.stop />
                  <i @click.stop>⋮⋮</i><span><strong>{{ entry.index + 1 }}. {{ entry.column.columnName }}</strong><small>{{ entry.column.columnComment }}</small></span>
                  <b v-if="entry.column.primaryKey" class="primary-key-marker">主键</b>
                  <b v-if="entry.column.missingInBase" class="missing-field-marker">母库已删除</b>
                  <button type="button" :data-testid="`move-selected-up-${entry.column.columnName}`" :disabled="isFieldMaintenanceDisabled || entry.column.missingInBase || entry.index === 0" title="上移" @click.stop="moveSelected(entry.index, -1)">↑</button>
                  <button type="button" :data-testid="`move-selected-down-${entry.column.columnName}`" :disabled="isFieldMaintenanceDisabled || entry.column.missingInBase || entry.index === selectedColumns.length - 1" title="下移" @click.stop="moveSelected(entry.index, 1)">↓</button>
                </li>
              </TransitionGroup>
            </article>
          </div>
        </section>

        <section class="editor-block registration-block">
          <div class="block-heading"><strong>3. 登记信息</strong><span>带 * 为必填项</span></div>
          <div class="registration-form">
            <label>领域 *<select v-model="form.domain" :disabled="isFieldMaintenanceDisabled"><option value="">请选择</option><option v-for="domain in domains" :key="domain">{{ domain }}</option></select></label>
            <label>小组负责人 *
              <div class="group-owner-picker">
                <input v-model="form.groupOwnerDisplay" data-testid="group-owner-search" type="search" placeholder="姓名或账号" :disabled="isFieldMaintenanceDisabled" @input="searchGroupOwners" />
                <div v-if="groupOwnerOptions.length" class="group-owner-options">
                  <button
                    v-for="user in groupOwnerOptions"
                    :key="user.username"
                    type="button"
                    :data-testid="`group-owner-option-${user.username}`"
                    @click="selectGroupOwner(user)"
                  >{{ user.displayName }}</button>
                </div>
              </div>
            </label>
          </div>
          <p v-if="groupOwnerError" class="registration-error">{{ groupOwnerError }}</p>
        </section>
      </div>

      <p v-if="saveError?.type === 'SAVE_FAILED'" class="registration-error save-error" data-testid="registration-save-error" role="alert">{{ saveError.message }}</p>

      <footer class="editor-footer">
        <span>{{ selectedTable ? `当前：${selectedTable.tableName}` : '请先检索并选择母库表' }}</span>
        <button type="button" @click="emit('close')">取消</button>
        <button type="button" data-testid="submit-registration" :class="isDeleteAction ? 'danger' : 'primary'" :disabled="!canSubmit" :title="hasMissingSelectedColumns && !isTableMissingCleanup ? '请先移除母库已删除字段' : ''" @click="submitRegistration">{{ isTableMissingCleanup ? '删除整表登记' : isDeleteMode ? '删除登记' : '保存' }}</button>
      </footer>
    </section>
    <section v-if="deleteConfirmationVisible" class="delete-confirmation" data-testid="delete-confirmation" role="alertdialog" aria-modal="true">
      <h4>确认删除登记</h4>
      <p>{{ isTableMissingCleanup ? '母库表已删除，继续后将删除整张表的登记记录，历史审计仍会保留。' : '当前表的比对字段已全部移除，继续后将删除整张表的登记记录，历史记录仍会保留。' }}</p>
      <p v-if="saveError?.type === 'SAVE_FAILED'" class="registration-error" role="alert">{{ saveError.message }}</p>
      <div><button type="button" @click="deleteConfirmationVisible = false">返回检查</button><button type="button" class="danger" data-testid="confirm-delete-registration" @click="confirmDelete">确认删除</button></div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Database } from 'lucide-vue-next'
import { searchReplayIssueUsers } from '../../api/replayIssues.js'
import { getMockColumns, searchMockTables } from './replayDatabaseComparisonMock.js'

const props = defineProps({
  registrations: { type: Array, default: () => [] },
  initialRegistration: { type: Object, default: null },
  searchUsers: { type: Function, default: searchReplayIssueUsers },
  loadColumns: { type: Function, default: getMockColumns },
  searchTables: { type: Function, default: searchMockTables },
  loadRegistration: { type: Function, default: null },
  saveError: { type: Object, default: null },
})
const emit = defineEmits(['close', 'save', 'delete'])

const domains = ['存款组', '贷款组', '公共组', '结算组', '平台组']
const tableKeywordInput = ref('')
const tableSearchExecuted = ref(false)
const selectedTable = ref(null)
const allColumns = ref([])
const columnsLoaded = ref(false)
const selectedColumns = ref([])
const availableSelection = ref([])
const selectedSelection = ref([])
const fieldKeyword = ref('')
const selectedFieldKeyword = ref('')
const fieldFilter = ref('ALL')
const draggedFieldIndex = ref(-1)
const lastFieldMove = ref(null)
const recentlyMovedFieldName = ref('')
const deleteConfirmationVisible = ref(false)
const groupOwnerOptions = ref([])
const groupOwnerError = ref('')
const reconciledPrimaryKeySignature = ref('')
const form = reactive({ domain: '', groupOwnerUsername: '', groupOwnerName: '', groupOwnerDisplay: '' })

const tableResults = ref([])
const isEditing = computed(() => selectedTable.value?.registrationStatus === 'ACTIVE')
const isReregister = computed(() => selectedTable.value?.registrationStatus === 'DELETED')
const isTableMissingCleanup = computed(() => selectedTable.value?.metadataValidation?.status === 'TABLE_MISSING')
const isPrimaryKeyMissing = computed(() => Boolean(
  selectedTable.value
  && columnsLoaded.value
  && !isTableMissingCleanup.value
  && currentPrimaryKeys(allColumns.value).length === 0
))
const isFieldMaintenanceDisabled = computed(() => isTableMissingCleanup.value || isPrimaryKeyMissing.value)
const isDeleteMode = computed(() => isEditing.value && selectedColumns.value.length === 0)
const isDeleteAction = computed(() => isTableMissingCleanup.value || isDeleteMode.value)
const missingSelectedColumns = computed(() => selectedColumns.value.filter(column => column.missingInBase))
const hasMissingSelectedColumns = computed(() => missingSelectedColumns.value.length > 0)
const canSubmit = computed(() => {
  if (!selectedTable.value) return false
  if (isTableMissingCleanup.value) return true
  if (isPrimaryKeyMissing.value) return false
  if (isDeleteMode.value) return true
  if (hasMissingSelectedColumns.value) return false
  return selectedColumns.value.length > 0 && form.domain && form.groupOwnerUsername
})
const availableColumns = computed(() => {
  const selectedNames = new Set(selectedColumns.value.map(column => column.columnName))
  return allColumns.value.filter(column => !selectedNames.has(column.columnName))
})
const matchesFieldKeyword = (column, keyword) => {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase()
  if (!normalizedKeyword) return true
  if (!keyword.includes('、')) {
    return `${column.columnName} ${column.columnComment}`.toLocaleLowerCase().includes(normalizedKeyword)
  }
  const segments = keyword.split('、')
  const currentSegment = segments.pop().trim().toLocaleLowerCase()
  const exactNames = new Set(segments
    .map(name => name.trim().toLocaleLowerCase())
    .filter(Boolean))
  const normalizedColumnName = column.columnName.toLocaleLowerCase()
  const matchesCurrentSegment = !currentSegment
    || `${column.columnName} ${column.columnComment}`.toLocaleLowerCase().includes(currentSegment)
  return exactNames.has(normalizedColumnName) || matchesCurrentSegment
}
const filteredAvailableColumns = computed(() => {
  return availableColumns.value.filter(column => {
    if (fieldFilter.value === 'PRIMARY_KEY' && !column.primaryKey) return false
    if (fieldFilter.value === 'NON_PRIMARY_KEY' && column.primaryKey) return false
    return matchesFieldKeyword(column, fieldKeyword.value)
  })
})
const filteredSelectedColumns = computed(() => {
  return selectedColumns.value
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => matchesFieldKeyword(column, selectedFieldKeyword.value))
})

let tableSearchTimer
let tableSearchRequestId = 0
let columnLoadRequestId = 0
let recentMoveTimer

watch(tableKeywordInput, value => {
  clearTimeout(tableSearchTimer)
  const keyword = value.trim()
  const requestId = ++tableSearchRequestId
  tableResults.value = []
  if (keyword.length < 2) {
    tableSearchExecuted.value = false
    return
  }
  tableSearchTimer = setTimeout(async () => {
    tableSearchExecuted.value = true
    try {
      const items = await props.searchTables(keyword, props.registrations)
      if (requestId === tableSearchRequestId) tableResults.value = items || []
    } catch {
      if (requestId === tableSearchRequestId) tableResults.value = []
    }
  }, 250)
})

watch(() => props.saveError, async saveError => {
  if (!['PRIMARY_KEY_CHANGED', 'PRIMARY_KEY_MISSING'].includes(saveError?.type) || !selectedTable.value) return
  columnsLoaded.value = false
  const latestColumns = await props.loadColumns(selectedTable.value.tableName)
  allColumns.value = latestColumns || []
  columnsLoaded.value = true
  selectedColumns.value = reconcileSelectedColumns(
    selectedColumns.value, allColumns.value, saveError.type === 'PRIMARY_KEY_CHANGED', 'edit',
  )
  reconciledPrimaryKeySignature.value = primaryKeySignature(allColumns.value)
  selectedSelection.value = selectedSelection.value.filter(name => {
    const column = selectedColumns.value.find(candidate => candidate.columnName === name)
    return column && !isProtectedPrimaryKey(column)
  })
})

onBeforeUnmount(() => {
  clearTimeout(tableSearchTimer)
  clearTimeout(recentMoveTimer)
})

const mergeRegisteredFields = (registeredFields, currentColumns) => {
  const currentByName = new Map(currentColumns.map(column => [column.columnName, column]))
  return registeredFields.map((field, index) => {
    const fieldName = field.name || field.columnName
    return currentByName.get(fieldName) || {
    columnName: fieldName,
    columnComment: field.comment || '',
    dataType: '',
    primaryKey: Boolean(field.primaryKey),
    ordinalPosition: null,
    comparisonOrder: index + 1,
    missingInBase: true,
    }
  })
}

const isProtectedPrimaryKey = column => Boolean(column.primaryKey && !column.missingInBase)

const currentPrimaryKeys = columns => columns
  .filter(column => column.primaryKey)
  .sort((left, right) => (
    (left.primaryKeyOrder ?? left.ordinalPosition ?? Number.MAX_SAFE_INTEGER)
    - (right.primaryKeyOrder ?? right.ordinalPosition ?? Number.MAX_SAFE_INTEGER)
  ))

const primaryKeySignature = columns => currentPrimaryKeys(columns)
  .map(column => column.columnName.toLocaleLowerCase())
  .sort()
  .join('|')

const reconcileSelectedColumns = (registeredFields, currentColumns, primaryKeyChanged, mode) => {
  const restored = mergeRegisteredFields(registeredFields, currentColumns)
  if (mode === 'add' || mode === 'reregister') return currentPrimaryKeys(currentColumns)
  if (!primaryKeyChanged) return restored
  const keys = currentPrimaryKeys(currentColumns)
  const keyNames = new Set(keys.map(column => column.columnName))
  return [...keys, ...restored.filter(column => !keyNames.has(column.columnName))]
}

const mapHistoricalFields = registeredFields => registeredFields.map((field, index) => ({
  columnName: field.name || field.columnName,
  columnComment: field.comment || field.columnComment || '',
  dataType: field.dataType || '',
  primaryKey: Boolean(field.primaryKey),
  ordinalPosition: field.ordinalPosition ?? null,
  comparisonOrder: field.comparisonOrder || index + 1,
  missingInBase: false,
  existsInBase: false,
}))

const resetFieldOrderFeedback = () => {
  lastFieldMove.value = null
  recentlyMovedFieldName.value = ''
  clearTimeout(recentMoveTimer)
}

const selectTable = table => {
  selectedTable.value = table
  const localRegistration = props.initialRegistration?.id === table.registrationId
    ? props.initialRegistration
    : props.registrations.find(item => item.tableName === table.tableName)
  const applyRegistration = registration => {
    const requestId = ++columnLoadRequestId
    columnsLoaded.value = false
    const applyColumns = columns => {
      if (requestId !== columnLoadRequestId) return
      allColumns.value = columns || []
      columnsLoaded.value = true
      const mode = table.registrationStatus === 'DELETED'
        ? 'reregister'
        : table.registrationStatus === 'ACTIVE' ? 'edit' : 'add'
      const metadataValidation = registration?.metadataValidation || table.metadataValidation
      selectedTable.value = { ...table, metadataValidation }
      selectedColumns.value = reconcileSelectedColumns(
        registration?.fields || [],
        allColumns.value,
        Boolean(metadataValidation?.primaryKeyChanged),
        mode,
      )
      reconciledPrimaryKeySignature.value = primaryKeySignature(allColumns.value)
      resetFieldOrderFeedback()
    }
    if (table.metadataValidation?.status === 'TABLE_MISSING') {
      allColumns.value = []
      columnsLoaded.value = false
      selectedColumns.value = mapHistoricalFields(registration?.fields || [])
      resetFieldOrderFeedback()
    } else {
      const columns = props.loadColumns(table.tableName)
      if (columns?.then) columns.then(applyColumns)
      else applyColumns(columns)
    }
    form.domain = registration?.domain || ''
    form.groupOwnerUsername = registration?.groupOwnerUsername || registration?.groupOwnerEmpNo || ''
    form.groupOwnerName = registration?.groupOwnerName || registration?.groupOwner || ''
    form.groupOwnerDisplay = registration?.groupOwner || registration?.groupOwnerName || ''
    groupOwnerOptions.value = []
    groupOwnerError.value = ''
    availableSelection.value = []
    selectedSelection.value = []
    fieldKeyword.value = ''
    selectedFieldKeyword.value = ''
    fieldFilter.value = 'ALL'
  }
  if (!localRegistration && table.registrationStatus !== 'UNREGISTERED' && props.loadRegistration) {
    const registration = props.loadRegistration(table.registrationId)
    if (registration?.then) registration.then(applyRegistration)
    else applyRegistration(registration)
  } else applyRegistration(localRegistration)
}

const invertSelection = (currentSelection, visibleNames) => {
  const visible = new Set(visibleNames)
  const selected = new Set(currentSelection)
  return [
    ...currentSelection.filter(name => !visible.has(name)),
    ...visibleNames.filter(name => !selected.has(name)),
  ]
}

const selectAllAvailable = () => { availableSelection.value = filteredAvailableColumns.value.map(column => column.columnName) }
const invertAvailableSelection = () => {
  availableSelection.value = invertSelection(availableSelection.value, filteredAvailableColumns.value.map(column => column.columnName))
}
const removableSelectedNames = () => filteredSelectedColumns.value
  .map(({ column }) => column)
  .filter(column => !isProtectedPrimaryKey(column))
  .map(column => column.columnName)

const selectAllSelected = () => { selectedSelection.value = removableSelectedNames() }
const invertSelectedSelection = () => {
  selectedSelection.value = invertSelection(selectedSelection.value, removableSelectedNames())
}
const toggleSelectedColumn = columnName => {
  if (isFieldMaintenanceDisabled.value) return
  const column = selectedColumns.value.find(candidate => candidate.columnName === columnName)
  if (column && isProtectedPrimaryKey(column)) return
  selectedSelection.value = selectedSelection.value.includes(columnName)
    ? selectedSelection.value.filter(name => name !== columnName)
    : [...selectedSelection.value, columnName]
}

const moveFieldsRight = () => {
  if (isFieldMaintenanceDisabled.value) return
  const selectedNames = new Set(availableSelection.value)
  selectedColumns.value.push(...allColumns.value.filter(column => selectedNames.has(column.columnName)))
  availableSelection.value = []
}

const moveFieldsLeft = () => {
  if (isFieldMaintenanceDisabled.value) return
  const removedNames = new Set(selectedSelection.value)
  selectedColumns.value = selectedColumns.value.filter(column => (
    isProtectedPrimaryKey(column) || !removedNames.has(column.columnName)
  ))
  selectedSelection.value = []
}

const markRecentlyMoved = columnName => {
  recentlyMovedFieldName.value = columnName
  clearTimeout(recentMoveTimer)
  recentMoveTimer = setTimeout(() => {
    if (recentlyMovedFieldName.value === columnName) recentlyMovedFieldName.value = ''
  }, 1500)
}

const reorderSelectedField = (fromIndex, toIndex) => {
  if (isFieldMaintenanceDisabled.value) return
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= selectedColumns.value.length || toIndex >= selectedColumns.value.length || fromIndex === toIndex) return
  const beforeColumns = [...selectedColumns.value]
  const nextColumns = [...beforeColumns]
  const [field] = nextColumns.splice(fromIndex, 1)
  nextColumns.splice(toIndex, 0, field)
  selectedColumns.value = nextColumns
  lastFieldMove.value = {
    columnName: field.columnName,
    fromPosition: fromIndex + 1,
    toPosition: toIndex + 1,
  }
  markRecentlyMoved(field.columnName)
}

const moveSelected = (index, offset) => reorderSelectedField(index, index + offset)

const startDraggingField = entry => {
  draggedFieldIndex.value = entry.column.missingInBase ? -1 : entry.index
}

const dropSelectedField = targetIndex => {
  if (draggedFieldIndex.value < 0) return
  reorderSelectedField(draggedFieldIndex.value, targetIndex)
  draggedFieldIndex.value = -1
}

const searchGroupOwners = async () => {
  if (isFieldMaintenanceDisabled.value) return
  form.groupOwnerUsername = ''
  form.groupOwnerName = ''
  groupOwnerError.value = ''
  const keyword = form.groupOwnerDisplay.trim()
  if (!keyword) {
    groupOwnerOptions.value = []
    return
  }
  try {
    groupOwnerOptions.value = await props.searchUsers(keyword)
  } catch (cause) {
    groupOwnerOptions.value = []
    groupOwnerError.value = `小组负责人检索失败：${cause?.message || cause}`
  }
}

const selectGroupOwner = user => {
  form.groupOwnerUsername = user.username
  form.groupOwnerName = user.realName || user.displayName || user.username
  form.groupOwnerDisplay = user.displayName || user.realName || user.username
  groupOwnerOptions.value = []
  groupOwnerError.value = ''
}

const submitRegistration = () => {
  if (!canSubmit.value) return
  if (isDeleteAction.value) {
    deleteConfirmationVisible.value = true
    return
  }
  const finishSubmit = latestColumns => {
    const normalizedLatestColumns = latestColumns || []
    allColumns.value = normalizedLatestColumns
    columnsLoaded.value = true
    if (currentPrimaryKeys(normalizedLatestColumns).length === 0) {
      selectedColumns.value = selectedColumns.value.map((column, index) => {
        const latestColumn = normalizedLatestColumns.find(candidate => candidate.columnName === column.columnName)
        return latestColumn || { ...column, comparisonOrder: index + 1, missingInBase: true }
      })
      return
    }
    const latestSignature = primaryKeySignature(normalizedLatestColumns)
    if (latestSignature !== reconciledPrimaryKeySignature.value) {
      selectedColumns.value = reconcileSelectedColumns(selectedColumns.value, normalizedLatestColumns, true, 'edit')
      selectedSelection.value = selectedSelection.value.filter(name => {
        const column = selectedColumns.value.find(candidate => candidate.columnName === name)
        return column && !isProtectedPrimaryKey(column)
      })
      reconciledPrimaryKeySignature.value = latestSignature
      return
    }
    selectedColumns.value = selectedColumns.value.map((column, index) => {
    const latestColumn = normalizedLatestColumns.find(candidate => candidate.columnName === column.columnName)
    return latestColumn || { ...column, comparisonOrder: index + 1, missingInBase: true }
    })
    if (hasMissingSelectedColumns.value) return
    emit('save', {
    mode: isReregister.value ? 'reregister' : isEditing.value ? 'edit' : 'add',
    id: selectedTable.value.registrationId,
    version: selectedTable.value.registrationVersion,
    tableName: selectedTable.value.tableName,
    tableComment: selectedTable.value.tableComment,
    fieldNames: selectedColumns.value.map(column => column.columnName),
    fields: selectedColumns.value.map(column => ({ name: column.columnName, comment: column.columnComment })),
    domain: form.domain,
    groupOwnerUsername: form.groupOwnerUsername,
    groupOwnerName: form.groupOwnerName,
    })
  }
  const latestColumns = props.loadColumns(selectedTable.value.tableName)
  if (latestColumns?.then) latestColumns.then(finishSubmit)
  else finishSubmit(latestColumns)
}

const confirmDelete = () => emit('delete', {
  id: selectedTable.value.registrationId,
  tableName: selectedTable.value.tableName,
  version: selectedTable.value.registrationVersion,
  deleteWhenNoFields: true,
  reason: isTableMissingCleanup.value ? '母库表已删除，清理登记' : '全部比对字段已移除',
})

const resetSelectedTable = () => {
  columnLoadRequestId += 1
  selectedTable.value = null
  allColumns.value = []
  columnsLoaded.value = false
  selectedColumns.value = []
  resetFieldOrderFeedback()
  availableSelection.value = []
  selectedSelection.value = []
  selectedFieldKeyword.value = ''
  reconciledPrimaryKeySignature.value = ''
  tableSearchExecuted.value = tableKeywordInput.value.trim().length >= 2
  groupOwnerOptions.value = []
  groupOwnerError.value = ''
}

if (props.initialRegistration) {
  selectTable({
    schemaName: 'CCBS_BASE',
    tableName: props.initialRegistration.tableName,
    tableComment: props.initialRegistration.tableComment,
    registrationStatus: 'ACTIVE',
    registrationId: props.initialRegistration.id,
    registrationVersion: props.initialRegistration.version,
    metadataValidation: props.initialRegistration.metadataValidation,
  })
}
</script>

<style scoped>
.comparison-editor-backdrop { position: fixed; inset: 0; z-index: 1800; display: grid; place-items: center; background: rgba(18, 29, 38, .5); }
.comparison-editor { width: 92vw; height: 96vh; max-height: calc(100vh - 16px); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; border-radius: 8px; background: #f4f7f9; box-shadow: 0 18px 50px rgba(0, 0, 0, .3); color: #263442; }
.editor-header { display: flex; align-items: center; justify-content: space-between; padding: 15px 20px; color: #fff; background: #176f74; }
.editor-header h3, .editor-header p { margin: 0; }.editor-header h3 { font-size: 18px; }.editor-header p { margin-top: 4px; color: #d7eeee; font-size: 12px; }
.icon-close { border: 0; color: #fff; background: transparent; font-size: 28px; cursor: pointer; }
.editor-body { min-height: 0; display: flex; flex-direction: column; overflow: auto; padding: 14px 18px; }
.editor-block { margin-bottom: 12px; padding: 13px 15px; border: 1px solid #dbe3e8; border-radius: 6px; background: #fff; }
.fields-block { min-height: 450px; flex: 1 1 0; display: flex; flex-direction: column; }
.registration-block { flex: 0 0 auto; margin-bottom: 0; }
.block-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 11px; color: #314454; }.block-heading strong { color: #176f74; }.block-heading span { color: #758392; font-size: 12px; }
.table-search input { width: 100%; height: 34px; padding: 0 10px; border: 1px solid #cbd6de; border-radius: 4px; box-sizing: border-box; }
.primary { border-color: #168478 !important; color: #fff !important; background: #168478 !important; }.table-results { max-height: 170px; margin-top: 8px; overflow: auto; border: 1px solid #dce4e9; border-radius: 4px; }
.table-result { width: 100%; display: flex; align-items: center; gap: 12px; padding: 9px 11px; border: 0; border-bottom: 1px solid #edf1f3; background: #fff; text-align: left; cursor: pointer; }.table-result:hover { background: #edf8f7; }.table-result > span { flex: 1; }.table-result strong, .table-result small, .selected-table strong, .selected-table small { display: block; }.table-result small, .selected-table small { margin-top: 3px; color: #7c8995; }.table-result em, .selected-table em { padding: 3px 8px; border-radius: 10px; font-size: 11px; font-style: normal; }.active { color: #b66000; background: #fff0d2; }.unregistered { color: #0c786e; background: #dff5f1; }
.selected-table { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-left: 4px solid #168478; background: #f0f8f7; }.selected-table > span { flex: 1; }.text-button { border: 0; color: #167e76; background: transparent; cursor: pointer; }
.table-missing-cleanup-warning { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 9px 11px; border-left: 4px solid #d94a47; color: #a92f2b; background: #fff0ef; font-size: 12px; }.table-missing-cleanup-warning span { color: #b7524e; }
.primary-key-missing-warning { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 9px 11px; border-left: 4px solid #d94a47; color: #a92f2b; background: #fff0ef; font-size: 12px; }.primary-key-missing-warning span { color: #b7524e; }
.transfer-layout { min-height: 390px; flex: 1 1 0; display: grid; grid-template-columns: minmax(0, 1fr) 92px minmax(0, 1fr); gap: 12px; }.field-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #d9e2e7; border-radius: 5px; background: #f5f8fa; }.field-panel > header { flex: 0 0 auto; display: flex; justify-content: space-between; padding: 9px 11px; color: #fff; background: #237b80; }.field-panel > header span { font-size: 12px; }.field-panel-placeholder { display: grid; min-height: 250px; place-items: center; padding: 20px; color: #8a96a1; text-align: center; }.transfer-actions { display: flex; flex-direction: column; justify-content: center; gap: 10px; }.transfer-actions button { padding: 7px 4px; }.selected-preview { margin: 0; padding: 0; list-style: none; }.selected-preview li { display: grid; grid-template-columns: auto auto minmax(0, 1fr) repeat(4, auto); align-items: center; gap: 7px; min-height: 42px; padding: 5px 8px; border-bottom: 1px solid #dfe7ec; background: #fff; cursor: pointer; }.selected-preview li:hover { background: #eef8f7; }.selected-preview small { display: block; color: #84909a; }.selected-preview li > i { color: #84919c; font-style: normal; cursor: grab; }.selected-preview li > span { min-width: 0; }.selected-preview li button { width: 27px; height: 27px; padding: 0; border: 1px solid #cad5dc; border-radius: 3px; background: #fff; }.selected-preview li button:disabled { opacity: .35; }
.field-order-move { transition: transform 180ms ease; }.selected-preview li.is-recently-moved { position: relative; z-index: 1; border-color: #17a28f; background: #edfbf8; box-shadow: inset 4px 0 #17a28f, 0 0 0 2px rgba(23, 162, 143, .12); }.field-order-feedback { flex: 0 0 auto; padding: 7px 9px; border-bottom: 1px solid #a9ddd6; color: #176f74; background: #e7f7f4; font-size: 11px; }
.field-tools { flex: 0 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; padding: 7px; border-bottom: 1px solid #e2e8ec; background: #fff; }.field-tools input { min-width: 0; padding: 6px 7px; border: 1px solid #ccd7de; border-radius: 3px; }.field-filters, .selection-actions { display: flex; }.field-filters button, .selection-actions button { padding: 4px 7px; border: 1px solid #cad5dc; background: #fff; font-size: 11px; }.field-filters button.active { color: #fff; background: #168478; }.selection-tools { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-bottom: 1px solid #dfe7ec; background: #f6f9fa; }.selection-tools button { padding: 3px 8px; border: 1px solid #c4d0d8; border-radius: 3px; background: #fff; color: #26747a; }.selection-tools span { margin-left: auto; color: #7c8994; font-size: 11px; }.field-list-scroll { flex: 1 1 auto; min-height: 0; max-height: none; overflow: auto; background: #fff; }.available-field-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 8px; min-height: 42px; padding: 6px 8px; border-bottom: 1px solid #dfe7ec; background: #fff; cursor: pointer; }.available-field-row:hover { background: #eef8f7; }.available-field-row span, .available-field-row strong, .available-field-row small { min-width: 0; }.available-field-row strong, .available-field-row small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.available-field-row small { margin-top: 2px; color: #7f8b95; }.available-field-row em { color: #687682; font-size: 10px; font-style: normal; }.available-field-row input, .selected-preview input { width: 18px; height: 18px; margin: 0; accent-color: #168478; cursor: pointer; }.primary-key-marker, .missing-field-marker { padding: 2px 5px; border-radius: 8px; color: #d9363e; background: #fff0f0; font-size: 10px; font-weight: 700; white-space: nowrap; }.missing-fields-warning { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-bottom: 1px solid #efb5b3; color: #b52f2b; background: #fff0ef; font-size: 11px; }.missing-fields-warning span { color: #c34a46; }.selected-preview li.is-missing-in-base { border: 1px solid #e35a56; border-left-width: 4px; background: #fff1f0; }.selected-preview li.is-missing-in-base strong { color: #bc302c; }.selected-preview li.is-missing-in-base small { color: #b05c58; }.field-panel-placeholder.compact { min-height: 240px; }
.registration-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }.registration-form label { display: grid; gap: 5px; color: #52606d; font-size: 12px; }.registration-form input, .registration-form select { box-sizing: border-box; width: 100%; padding: 7px 8px; border: 1px solid #cbd6de; border-radius: 4px; background: #fff; }
.save-error { flex-shrink: 0; padding: 8px 20px; }
.group-owner-picker { position: relative; }.group-owner-options { position: absolute; z-index: 3; top: calc(100% + 4px); right: 0; left: 0; max-height: 160px; overflow: auto; border: 1px solid #cbd6de; border-radius: 4px; background: #fff; box-shadow: 0 7px 18px rgba(30, 53, 70, .16); }.group-owner-options button { width: 100%; padding: 8px 10px; border: 0; border-bottom: 1px solid #edf1f3; background: #fff; text-align: left; cursor: pointer; }.group-owner-options button:hover { background: #edf8f7; }.registration-error { margin: 8px 0 0; color: #c43f3a; font-size: 12px; }
.editor-footer { display: flex; align-items: center; justify-content: flex-end; gap: 9px; padding: 11px 18px; border-top: 1px solid #dbe3e8; background: #fff; }.editor-footer span { margin-right: auto; color: #74818e; font-size: 12px; }.editor-footer button { min-width: 76px; padding: 7px 14px; border: 1px solid #cad4dc; border-radius: 4px; background: #fff; cursor: pointer; }.editor-footer button:disabled { opacity: .45; cursor: not-allowed; }
.danger { border-color: #d9534f !important; color: #fff !important; background: #d9534f !important; }.delete-confirmation { position: fixed; z-index: 1810; width: min(430px, 88vw); padding: 20px; border-radius: 7px; background: #fff; box-shadow: 0 16px 45px rgba(0, 0, 0, .35); }.delete-confirmation h4 { margin: 0 0 10px; color: #b93c38; }.delete-confirmation p { color: #56636f; line-height: 1.65; }.delete-confirmation div { display: flex; justify-content: flex-end; gap: 9px; }.delete-confirmation button { padding: 7px 13px; border: 1px solid #cbd5dc; border-radius: 4px; background: #fff; }
.empty-result { padding: 18px; color: #87939e; text-align: center; }
@media (max-width: 900px) { .comparison-editor { width: 96vw; height: 94vh; }.transfer-layout { grid-template-columns: 1fr; }.transfer-actions { flex-direction: row; }.registration-form { grid-template-columns: repeat(2, 1fr); } }
</style>
