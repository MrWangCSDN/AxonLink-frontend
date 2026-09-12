<template>
  <div class="comparison-editor-backdrop" data-testid="comparison-editor-backdrop">
    <section class="comparison-editor" role="dialog" aria-modal="true" aria-labelledby="comparison-editor-title">
      <header class="editor-header">
        <div>
          <h3 id="comparison-editor-title" data-testid="editor-title">{{ isEditing ? '编辑登记' : '新增登记' }}</h3>
          <p>选择 BASE 母库表并配置需要参与回放比对的字段</p>
        </div>
        <button type="button" class="icon-close" aria-label="关闭新增登记" @click="emit('close')">×</button>
      </header>

      <div class="editor-body">
        <section class="editor-block table-lookup">
          <div class="block-heading"><strong>1. 检索母库表</strong><span>固定 Schema：CCBS_BASE</span></div>
          <template v-if="!selectedTable">
            <div class="table-search">
              <input v-model.trim="tableKeywordInput" data-testid="table-search-input" type="search" placeholder="输入表英文名或中文名" @keyup.enter="runTableSearch" />
              <button type="button" class="primary" data-testid="table-search-button" @click="runTableSearch"><Search :size="15" /> 搜索</button>
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
                <em :class="table.registrationStatus.toLowerCase()">{{ table.registrationStatus === 'ACTIVE' ? '已登记 · 进入编辑' : '未登记' }}</em>
              </button>
              <p v-if="!tableResults.length" class="empty-result">未检索到匹配的母库表</p>
            </div>
          </template>
          <div v-else class="selected-table" data-testid="selected-table">
            <Database :size="18" />
            <span><strong>{{ selectedTable.tableName }}</strong><small>{{ selectedTable.tableComment }}</small></span>
            <em :class="isEditing ? 'active' : 'unregistered'">{{ isEditing ? '已登记 · 编辑模式' : '未登记 · 新增模式' }}</em>
            <button type="button" class="text-button" @click="resetSelectedTable">重新选择表</button>
          </div>
        </section>

        <section class="editor-block fields-block">
          <div class="block-heading"><strong>2. 选择并排序比对字段</strong><span>母库 {{ allColumns.length }} 个 · 已选择 {{ selectedColumns.length }} 个</span></div>
          <div class="transfer-layout">
            <article class="field-panel">
              <header><strong>母库字段</strong><span>{{ availableColumns.length }} 个可选</span></header>
              <div class="field-tools">
                <input v-model.trim="fieldKeyword" type="search" placeholder="搜索字段名或中文描述" />
                <div class="field-filters">
                  <button type="button" data-testid="field-filter-all" :class="{ active: fieldFilter === 'ALL' }" @click="fieldFilter = 'ALL'">全部</button>
                  <button type="button" data-testid="field-filter-primary" :class="{ active: fieldFilter === 'PRIMARY_KEY' }" @click="fieldFilter = 'PRIMARY_KEY'">主键</button>
                  <button type="button" :class="{ active: fieldFilter === 'NON_PRIMARY_KEY' }" @click="fieldFilter = 'NON_PRIMARY_KEY'">非主键</button>
                </div>
              </div>
              <div class="field-list-scroll" data-testid="available-fields">
                <label v-for="column in filteredAvailableColumns" :key="column.columnName" class="available-field-row" data-testid="available-field-row">
                  <input v-model="availableSelection" type="checkbox" :value="column.columnName" :data-testid="`available-field-${column.columnName}`" />
                  <span><strong>{{ column.columnName }}</strong><small>{{ column.columnComment || '暂无中文描述' }}</small></span>
                  <em>{{ column.dataType }}</em><b v-if="column.primaryKey">主键</b>
                </label>
                <div v-if="selectedTable && !filteredAvailableColumns.length" class="field-panel-placeholder compact">暂无可选字段</div>
                <div v-if="!selectedTable" class="field-panel-placeholder compact">请先选择母库表</div>
              </div>
            </article>
            <div class="transfer-actions"><button type="button" data-testid="move-fields-right" :disabled="!availableSelection.length" @click="moveFieldsRight">添加 →</button><button type="button" :disabled="!selectedSelection.length" @click="moveFieldsLeft">← 移除</button></div>
            <article class="field-panel" data-testid="selected-fields">
              <header><strong>已选比对字段</strong><span>{{ selectedColumns.length }} 个</span></header>
              <ol v-if="selectedColumns.length" class="selected-preview">
                <li v-for="(column, index) in selectedColumns" :key="column.columnName" draggable="true" data-testid="selected-field-row" @dragstart="draggedFieldIndex = index" @dragover.prevent @drop="dropSelectedField(index)">
                  <input v-model="selectedSelection" type="checkbox" :value="column.columnName" />
                  <i>⋮⋮</i><span><strong>{{ index + 1 }}. {{ column.columnName }}</strong><small>{{ column.columnComment }}</small></span>
                  <b v-if="column.primaryKey">主键</b>
                  <button type="button" :data-testid="`move-selected-up-${column.columnName}`" :disabled="index === 0" title="上移" @click="moveSelected(index, -1)">↑</button>
                  <button type="button" :disabled="index === selectedColumns.length - 1" title="下移" @click="moveSelected(index, 1)">↓</button>
                </li>
              </ol>
              <div v-else class="field-panel-placeholder">从左侧选择需要参与比对的字段</div>
            </article>
          </div>
        </section>

        <section class="editor-block">
          <div class="block-heading"><strong>3. 登记信息</strong><span>带 * 为必填项</span></div>
          <div class="registration-form">
            <label>领域 *<select v-model="form.domain"><option value="">请选择</option><option v-for="domain in domains" :key="domain">{{ domain }}</option></select></label>
            <label>负责人 *<input v-model="form.owner" placeholder="搜索人员" /></label>
            <label>归属小组 *<select v-model="form.group"><option value="">请选择</option><option v-for="group in groups" :key="group">{{ group }}</option></select></label>
            <label>登记日期 *<input v-model="form.date" type="date" /></label>
            <label class="remark">备注<textarea v-model="form.remark" rows="2" placeholder="请输入备注"></textarea></label>
          </div>
        </section>
      </div>

      <footer class="editor-footer">
        <span>{{ selectedTable ? `当前：${selectedTable.tableName}` : '请先检索并选择母库表' }}</span>
        <button type="button" @click="emit('close')">取消</button>
        <button type="button" class="primary" :disabled="!selectedTable || !selectedColumns.length">保存</button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Database, Search } from 'lucide-vue-next'
import { getMockColumns, searchMockTables } from './replayDatabaseComparisonMock.js'

const props = defineProps({
  registrations: { type: Array, default: () => [] },
  initialRegistration: { type: Object, default: null },
})
const emit = defineEmits(['close', 'save', 'delete'])

const domains = ['公共', '存款', '贷款', '结算']
const groups = domains.map(domain => `${domain}组`)
const tableKeywordInput = ref('')
const tableKeyword = ref('')
const tableSearchExecuted = ref(false)
const selectedTable = ref(null)
const allColumns = ref([])
const selectedColumns = ref([])
const availableSelection = ref([])
const selectedSelection = ref([])
const fieldKeyword = ref('')
const fieldFilter = ref('ALL')
const draggedFieldIndex = ref(-1)
const form = reactive({ domain: '', owner: '', group: '', date: '', remark: '' })

const tableResults = computed(() => searchMockTables(tableKeyword.value, props.registrations))
const isEditing = computed(() => selectedTable.value?.registrationStatus === 'ACTIVE')
const availableColumns = computed(() => {
  const selectedNames = new Set(selectedColumns.value.map(column => column.columnName))
  return allColumns.value.filter(column => !selectedNames.has(column.columnName))
})
const filteredAvailableColumns = computed(() => {
  const keyword = fieldKeyword.value.toLocaleLowerCase()
  return availableColumns.value.filter(column => {
    if (fieldFilter.value === 'PRIMARY_KEY' && !column.primaryKey) return false
    if (fieldFilter.value === 'NON_PRIMARY_KEY' && column.primaryKey) return false
    return !keyword || `${column.columnName} ${column.columnComment}`.toLocaleLowerCase().includes(keyword)
  })
})

const runTableSearch = () => {
  tableKeyword.value = tableKeywordInput.value
  tableSearchExecuted.value = true
}

const selectTable = table => {
  selectedTable.value = table
  allColumns.value = getMockColumns(table.tableName)
  const registration = props.registrations.find(item => item.tableName === table.tableName)
  const selectedNames = registration?.fields?.map(field => field.name) || []
  selectedColumns.value = selectedNames
    .map(name => allColumns.value.find(column => column.columnName === name))
    .filter(Boolean)
  form.domain = registration?.domain || ''
  form.owner = registration?.owner || ''
  form.group = registration?.group || ''
  form.date = registration?.date || new Date().toISOString().slice(0, 10)
  form.remark = registration?.remark || ''
  availableSelection.value = []
  selectedSelection.value = []
  fieldKeyword.value = ''
  fieldFilter.value = 'ALL'
}

const moveFieldsRight = () => {
  const selectedNames = new Set(availableSelection.value)
  selectedColumns.value.push(...allColumns.value.filter(column => selectedNames.has(column.columnName)))
  availableSelection.value = []
}

const moveFieldsLeft = () => {
  const removedNames = new Set(selectedSelection.value)
  selectedColumns.value = selectedColumns.value.filter(column => !removedNames.has(column.columnName))
  selectedSelection.value = []
}

const moveSelected = (index, offset) => {
  const target = index + offset
  if (target < 0 || target >= selectedColumns.value.length) return
  const next = [...selectedColumns.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  selectedColumns.value = next
}

const dropSelectedField = targetIndex => {
  if (draggedFieldIndex.value < 0 || draggedFieldIndex.value === targetIndex) return
  const next = [...selectedColumns.value]
  const [field] = next.splice(draggedFieldIndex.value, 1)
  next.splice(targetIndex, 0, field)
  selectedColumns.value = next
  draggedFieldIndex.value = -1
}

const resetSelectedTable = () => {
  selectedTable.value = null
  allColumns.value = []
  selectedColumns.value = []
  availableSelection.value = []
  selectedSelection.value = []
  tableSearchExecuted.value = false
}

if (props.initialRegistration) {
  selectTable({
    schemaName: 'CCBS_BASE',
    tableName: props.initialRegistration.tableName,
    tableComment: props.initialRegistration.tableComment,
    registrationStatus: 'ACTIVE',
    registrationId: props.initialRegistration.id,
    registrationVersion: props.initialRegistration.version,
  })
}
</script>

<style scoped>
.comparison-editor-backdrop { position: fixed; inset: 0; z-index: 1800; display: grid; place-items: center; background: rgba(18, 29, 38, .5); }
.comparison-editor { width: 92vw; height: 88vh; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; border-radius: 8px; background: #f4f7f9; box-shadow: 0 18px 50px rgba(0, 0, 0, .3); color: #263442; }
.editor-header { display: flex; align-items: center; justify-content: space-between; padding: 15px 20px; color: #fff; background: #176f74; }
.editor-header h3, .editor-header p { margin: 0; }.editor-header h3 { font-size: 18px; }.editor-header p { margin-top: 4px; color: #d7eeee; font-size: 12px; }
.icon-close { border: 0; color: #fff; background: transparent; font-size: 28px; cursor: pointer; }
.editor-body { min-height: 0; overflow: auto; padding: 14px 18px 20px; }
.editor-block { margin-bottom: 12px; padding: 13px 15px; border: 1px solid #dbe3e8; border-radius: 6px; background: #fff; }
.block-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 11px; color: #314454; }.block-heading strong { color: #176f74; }.block-heading span { color: #758392; font-size: 12px; }
.table-search { display: flex; gap: 8px; }.table-search input { flex: 1; height: 34px; padding: 0 10px; border: 1px solid #cbd6de; border-radius: 4px; }.table-search button { display: inline-flex; align-items: center; gap: 5px; }
.primary { border-color: #168478 !important; color: #fff !important; background: #168478 !important; }.table-results { max-height: 170px; margin-top: 8px; overflow: auto; border: 1px solid #dce4e9; border-radius: 4px; }
.table-result { width: 100%; display: flex; align-items: center; gap: 12px; padding: 9px 11px; border: 0; border-bottom: 1px solid #edf1f3; background: #fff; text-align: left; cursor: pointer; }.table-result:hover { background: #edf8f7; }.table-result > span { flex: 1; }.table-result strong, .table-result small, .selected-table strong, .selected-table small { display: block; }.table-result small, .selected-table small { margin-top: 3px; color: #7c8995; }.table-result em, .selected-table em { padding: 3px 8px; border-radius: 10px; font-size: 11px; font-style: normal; }.active { color: #b66000; background: #fff0d2; }.unregistered { color: #0c786e; background: #dff5f1; }
.selected-table { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-left: 4px solid #168478; background: #f0f8f7; }.selected-table > span { flex: 1; }.text-button { border: 0; color: #167e76; background: transparent; cursor: pointer; }
.transfer-layout { display: grid; grid-template-columns: minmax(0, 1fr) 92px minmax(0, 1fr); gap: 12px; min-height: 245px; }.field-panel { overflow: hidden; border: 1px solid #d9e2e7; border-radius: 5px; }.field-panel > header { display: flex; justify-content: space-between; padding: 9px 11px; color: #fff; background: #237b80; }.field-panel > header span { font-size: 12px; }.field-panel-placeholder { display: grid; min-height: 190px; place-items: center; padding: 20px; color: #8a96a1; text-align: center; }.transfer-actions { display: flex; flex-direction: column; justify-content: center; gap: 10px; }.transfer-actions button { padding: 7px 4px; }.selected-preview { max-height: 205px; margin: 0; padding: 6px; overflow: auto; list-style: none; }.selected-preview li { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto auto auto; align-items: center; gap: 6px; padding: 5px 4px; border-bottom: 1px solid #edf1f3; cursor: grab; }.selected-preview small { display: block; color: #84909a; }.selected-preview li > i { color: #84919c; font-style: normal; }.selected-preview li > span { min-width: 0; }.selected-preview li button { width: 25px; height: 25px; padding: 0; border: 1px solid #cad5dc; border-radius: 3px; background: #fff; }.selected-preview li button:disabled { opacity: .35; }
.field-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; padding: 7px; border-bottom: 1px solid #e2e8ec; }.field-tools input { min-width: 0; padding: 6px 7px; border: 1px solid #ccd7de; border-radius: 3px; }.field-filters { display: flex; }.field-filters button { padding: 4px 7px; border: 1px solid #cad5dc; background: #fff; font-size: 11px; }.field-filters button.active { color: #fff; background: #168478; }.field-list-scroll { max-height: 205px; overflow: auto; }.available-field-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 7px; padding: 6px 8px; border-bottom: 1px solid #edf1f3; }.available-field-row:hover { background: #f1f9f8; }.available-field-row span, .available-field-row strong, .available-field-row small { min-width: 0; }.available-field-row strong, .available-field-row small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.available-field-row small { margin-top: 2px; color: #7f8b95; }.available-field-row em { color: #687682; font-size: 10px; font-style: normal; }.available-field-row b, .selected-preview b { padding: 2px 5px; border-radius: 8px; color: #087064; background: #dff4f0; font-size: 10px; }.field-panel-placeholder.compact { min-height: 145px; }
.registration-form { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }.registration-form label { display: grid; gap: 5px; color: #52606d; font-size: 12px; }.registration-form input, .registration-form select, .registration-form textarea { box-sizing: border-box; width: 100%; padding: 7px 8px; border: 1px solid #cbd6de; border-radius: 4px; background: #fff; }.remark { grid-column: 1 / -1; }
.editor-footer { display: flex; align-items: center; justify-content: flex-end; gap: 9px; padding: 11px 18px; border-top: 1px solid #dbe3e8; background: #fff; }.editor-footer span { margin-right: auto; color: #74818e; font-size: 12px; }.editor-footer button { min-width: 76px; padding: 7px 14px; border: 1px solid #cad4dc; border-radius: 4px; background: #fff; cursor: pointer; }.editor-footer button:disabled { opacity: .45; cursor: not-allowed; }
.empty-result { padding: 18px; color: #87939e; text-align: center; }
@media (max-width: 900px) { .comparison-editor { width: 96vw; height: 94vh; }.transfer-layout { grid-template-columns: 1fr; }.transfer-actions { flex-direction: row; }.registration-form { grid-template-columns: repeat(2, 1fr); } }
</style>
