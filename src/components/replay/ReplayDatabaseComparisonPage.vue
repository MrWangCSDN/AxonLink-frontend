<template>
  <main class="db-compare-page is-fixed-page">
    <header class="page-toolbar">
      <button class="nav-button" type="button" aria-label="打开导航" @click="$emit('toggleNavigation')">☰</button>
      <div>
        <h2>回放数据库比对字段登记</h2>
        <p>共 {{ filteredRows.length }} 张表 · {{ filteredFieldCount }} 个比对字段 <span>Mock 数据</span></p>
      </div>
      <div class="toolbar-actions">
        <button type="button" data-testid="reset-filters" @click="resetFilters">重置筛选条件</button>
        <button type="button" class="outlined">初始化导入</button>
        <button type="button" class="primary">＋ 新增登记</button>
      </div>
    </header>

    <section class="table-shell is-scroll-viewport" data-testid="table-viewport">
      <table class="is-fixed-layout">
        <thead data-testid="database-comparison-table-head" class="is-sticky">
          <tr>
            <th
              v-for="column in filterColumns"
              :key="column.key"
              class="has-white-divider"
              :class="{ 'primary-column': column.key === 'tableName' }"
            >
              <span>{{ column.label }}</span>
              <button
                type="button"
                class="replay-header-filter-button"
                data-testid="database-comparison-header-filter"
                :data-filter-key="column.key"
                :class="{ active: filters[column.key]?.length }"
                :title="`筛选${column.label}`"
                aria-label="打开筛选"
                @click.stop="openFilter(column.key, $event)"
              ><i aria-hidden="true"></i></button>
            </th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pagedRows" :key="row.tableName" data-testid="registration-row">
            <td class="primary-column"><strong>{{ row.tableName }}</strong><small>{{ row.tableComment }}</small></td>
            <td data-testid="domain-cell">{{ row.domain }}</td>
            <td
              class="fields"
              :class="{ 'is-expanded': isExpanded(row.tableName) }"
              :data-testid="`fields-${row.tableName}`"
              :title="allFields(row)"
            >
              <div v-if="isExpanded(row.tableName)" class="field-list">
                <span v-for="(field, fieldIndex) in row.fields" :key="field.name" class="field-item">
                  {{ formatField(field) }}<span v-if="fieldIndex < row.fields.length - 1" class="field-separator">、</span>
                </span>
              </div>
              <div v-else class="field-content">{{ displayedFields(row) }}</div>
              <div class="field-actions">
                <button
                  class="field-action"
                  type="button"
                  :data-testid="`expand-fields-${row.tableName}`"
                  @click="toggleFields(row.tableName)"
                >{{ isExpanded(row.tableName) ? '收起' : '展开' }}</button>
                <button
                  v-if="isExpanded(row.tableName)"
                  class="field-action"
                  type="button"
                  :data-testid="`copy-fields-${row.tableName}`"
                  @click="copyFields(row)"
                >{{ copiedTable === row.tableName ? '已复制' : '复制全部字段' }}</button>
              </div>
            </td>
            <td>{{ row.owner }}</td>
            <td>{{ row.group }}</td>
            <td>{{ row.date }}</td>
            <td><button class="link">查看</button><button class="link">编辑</button></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="activeFilterKey" class="replay-header-filter-panel" :style="filterPanelStyle" data-testid="header-filter-panel">
      <header><strong>筛选 {{ activeFilterLabel }}</strong></header>
      <div class="replay-header-filter-content">
        <div class="replay-header-filter-search"><input v-model.trim="filterSearchInput" data-testid="header-filter-search" type="search" placeholder="模糊搜索" /><button type="button" aria-label="查询筛选选项" title="查询" @click="runFilterSearch"><Search :size="14" /></button></div>
        <div class="replay-header-filter-actions"><button type="button" @click="selectAllOptions">全选</button><button type="button" @click="invertOptions">反选</button><span>筛选数（{{ visibleFilterOptions.length }}）</span><span>计数（{{ draftMatchedCount }}）</span></div>
        <div class="replay-header-filter-options">
          <label v-for="option in visibleFilterOptions" :key="option.value" data-testid="header-filter-option">
            <input v-model="filterDraft" type="checkbox" :value="option.value" />
            <span>{{ option.value }}</span><em>（{{ option.count }}）</em>
          </label>
          <p v-if="!visibleFilterOptions.length">暂无选项</p>
        </div>
      </div>
      <footer><button class="replay-header-filter-clear is-bordered" type="button" @click="clearActiveFilter">清空筛选</button><span></span><button type="button" aria-label="关闭筛选" @click="closeFilter">取消</button><button type="button" data-testid="apply-header-filter" class="primary" @click="applyFilter">确定</button></footer>
      <button class="replay-header-filter-resize-handle" type="button" aria-label="拖拽调整筛选窗口大小" data-testid="header-filter-resize-handle" @pointerdown="startFilterResize"></button>
    </section>

    <footer class="pager is-fixed-pager" data-testid="fixed-pager">
      <span data-testid="page-summary">共 {{ filteredRows.length }} 条，第 {{ page }} / {{ pageCount }} 页</span>
      <label>每页 <select v-model.number="pageSize" data-testid="page-size" @change="page = 1"><option :value="50">50</option><option :value="100">100</option><option :value="200">200</option></select> 条</label>
      <div class="page-actions">
        <button type="button" data-testid="previous-page" title="上一页" :disabled="page === 1" @click="goToPage(page - 1)">‹</button>
        <button type="button" data-testid="next-page" title="下一页" :disabled="page === pageCount" @click="goToPage(page + 1)">›</button>
      </div>
    </footer>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { Search } from 'lucide-vue-next'

defineEmits(['toggleNavigation'])

const seedRows = [
  { domain: '存款', tableName: 'kdpa_cb_acct_fzn_cntl_inf', tableComment: '对公存款账户冻结控制信息', fields: [{ name: 'fzn_cntl_id', comment: '冻结控制编号' }, { name: 'lglpern_cd', comment: '' }, { name: 'fzn_cntl_amt', comment: '冻结金额' }, { name: 'currency_cd', comment: '币种' }, { name: 'effective_dt', comment: '生效日期' }, { name: 'acct_status', comment: '账户状态' }], owner: '周皓', group: '存款组', date: '2026-09-07' },
  { domain: '存款', tableName: 'kdpl_cb_acct_fzn_cntl_oprn_detl', tableComment: '对公存款账户冻结控制操作明细', fields: [{ name: 'fzn_cntl_oprn_sn', comment: '冻结操作序号' }, { name: 'txn_dt', comment: '交易日期' }, { name: 'cncl_fzn_dectrl_amt', comment: '取消冻结金额' }, { name: 'operator_id', comment: '' }], owner: '周皓', group: '存款组', date: '2026-09-07' },
  { domain: '贷款', tableName: 'klna_ln_acct_base_info', tableComment: '贷款账户基础信息', fields: [{ name: 'loan_acct_no', comment: '贷款账号' }, { name: 'customer_no', comment: '客户号' }, { name: 'product_code', comment: '' }, { name: 'loan_status', comment: '贷款状态' }], owner: '李明', group: '贷款组', date: '2026-09-08' },
]

const domains = ['公共', '存款', '贷款', '结算']
const owners = ['周皓', '李明', '王芳', '陈晨', '赵磊']
const fieldCatalog = [
  ['acct_no', '账号'], ['customer_no', '客户号'], ['currency_cd', '币种'], ['balance_amt', '余额'],
  ['status_cd', '状态'], ['open_dt', '开户日期'], ['branch_no', '机构号'], ['product_cd', '产品代码'],
  ['txn_sn', '交易流水'], ['update_tm', '更新时间'], ['reserved_1', ''],
]

const createMockRow = index => {
  const domain = domains[(index - 1) % domains.length]
  const fieldCount = 4 + (index % 8)
  return {
    domain,
    tableName: `k${domain === '贷款' ? 'ln' : domain === '存款' ? 'dp' : domain === '结算' ? 'st' : 'pb'}_replay_compare_${String(index).padStart(3, '0')}`,
    tableComment: `${domain}回放比对业务表${index}`,
    fields: Array.from({ length: fieldCount }, (_, fieldIndex) => {
      const [name, comment] = fieldCatalog[(index + fieldIndex) % fieldCatalog.length]
      return { name: `${name}_${fieldIndex + 1}`, comment }
    }),
    owner: owners[(index - 1) % owners.length],
    group: `${domain}组`,
    date: `2026-09-${String(((index - 1) % 28) + 1).padStart(2, '0')}`,
  }
}

const rows = [...seedRows, ...Array.from({ length: 197 }, (_, index) => createMockRow(index + 4))]

const filterColumns = [
  { key: 'tableName', label: '表英文名 / 中文名' },
  { key: 'domain', label: '领域' },
  { key: 'fields', label: '比对字段' },
  { key: 'owner', label: '负责人' },
  { key: 'group', label: '归属大组' },
  { key: 'date', label: '登记日期' },
]

const filters = reactive({})
const activeFilterKey = ref('')
const filterSearchInput = ref('')
const filterSearch = ref('')
const filterDraft = ref([])
const page = ref(1)
const pageSize = ref(50)
const filterPanelSize = reactive({ width: 340, height: 300 })
const filterPanelStyle = reactive({ left: '8px', top: '8px', width: '340px', height: '300px' })
let filterResizeState = null

const expandedTables = ref(new Set())
const copiedTable = ref('')

const formatField = field => field.comment?.trim()
  ? `${field.name}(${field.comment.trim()})`
  : field.name

const allFields = row => row.fields.map(formatField).join('、')

const valuesFor = (row, key) => {
  if (key === 'tableName') return [`${row.tableName} / ${row.tableComment}`]
  if (key === 'fields') return row.fields.map(formatField)
  return [row[key]]
}

const matchesFilters = (row, excludedKey = '') => filterColumns.every(({ key }) => {
  if (key === excludedKey || !filters[key]?.length) return true
  return valuesFor(row, key).some(value => filters[key].includes(value))
})

const filteredRows = computed(() => rows.filter(row => matchesFilters(row)))
const filteredFieldCount = computed(() => filteredRows.value.reduce((total, row) => total + row.fields.length, 0))
const pageCount = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value)))
const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})
const activeFilterLabel = computed(() => filterColumns.find(column => column.key === activeFilterKey.value)?.label || '')
const filterOptions = computed(() => {
  if (!activeFilterKey.value) return []
  const counts = new Map()
  rows.filter(row => matchesFilters(row, activeFilterKey.value)).forEach(row => {
    valuesFor(row, activeFilterKey.value).forEach(value => counts.set(value, (counts.get(value) || 0) + 1))
  })
  return [...counts.entries()].map(([value, count]) => ({ value, count }))
    .sort((left, right) => left.value.localeCompare(right.value, 'zh-CN'))
})
const visibleFilterOptions = computed(() => {
  const keyword = filterSearch.value.toLocaleLowerCase()
  if (!keyword) return filterOptions.value
  return filterOptions.value.filter(option => option.value.toLocaleLowerCase().includes(keyword))
})
const draftMatchedCount = computed(() => {
  if (!activeFilterKey.value) return filteredRows.value.length
  const selected = filterDraft.value
  return rows.filter(row => matchesFilters(row, activeFilterKey.value)
    && (!selected.length || valuesFor(row, activeFilterKey.value).some(value => selected.includes(value)))).length
})

const displayedFields = row => {
  if (isExpanded(row.tableName)) return allFields(row)
  const preview = row.fields.slice(0, 3).map(formatField).join('、')
  return row.fields.length > 3 ? `${preview}…（${row.fields.length}）` : preview
}

const isExpanded = tableName => expandedTables.value.has(tableName)

const toggleFields = tableName => {
  const next = new Set(expandedTables.value)
  if (next.has(tableName)) next.delete(tableName)
  else next.add(tableName)
  expandedTables.value = next
  copiedTable.value = ''
}

const copyFields = async row => {
  await navigator.clipboard.writeText(allFields(row))
  copiedTable.value = row.tableName
}

const positionFilterPanel = anchor => {
  const margin = 8
  const gap = 6
  const rect = anchor?.getBoundingClientRect?.() || { left: margin, top: margin, bottom: margin }
  const viewportWidth = window.innerWidth || 1280
  const viewportHeight = window.innerHeight || 800
  const maxWidth = Math.max(300, viewportWidth - margin * 2)
  const maxHeight = Math.max(220, viewportHeight - margin * 2)
  filterPanelSize.width = Math.min(filterPanelSize.width, maxWidth)
  filterPanelSize.height = Math.min(filterPanelSize.height, maxHeight)
  const left = Math.max(margin, Math.min(rect.left, viewportWidth - filterPanelSize.width - margin))
  const belowTop = rect.bottom + gap
  const top = belowTop + filterPanelSize.height <= viewportHeight - margin
    ? belowTop
    : Math.max(margin, rect.top - filterPanelSize.height - gap)
  filterPanelStyle.left = `${Math.round(left)}px`
  filterPanelStyle.top = `${Math.round(top)}px`
  filterPanelStyle.width = `${Math.round(filterPanelSize.width)}px`
  filterPanelStyle.height = `${Math.round(filterPanelSize.height)}px`
}

const openFilter = async (key, event) => {
  activeFilterKey.value = key
  filterSearchInput.value = ''
  filterSearch.value = ''
  filterDraft.value = [...(filters[key] || [])]
  await nextTick()
  positionFilterPanel(event?.currentTarget)
}

const closeFilter = () => {
  activeFilterKey.value = ''
  filterSearchInput.value = ''
  filterSearch.value = ''
  filterDraft.value = []
}

const runFilterSearch = () => {
  filterSearch.value = filterSearchInput.value
}

const selectAllOptions = () => { filterDraft.value = visibleFilterOptions.value.map(option => option.value) }
const invertOptions = () => {
  const selected = new Set(filterDraft.value)
  filterDraft.value = visibleFilterOptions.value.map(option => option.value).filter(value => !selected.has(value))
}
const applyFilter = () => {
  filters[activeFilterKey.value] = [...filterDraft.value]
  page.value = 1
  closeFilter()
}
const clearActiveFilter = () => {
  delete filters[activeFilterKey.value]
  page.value = 1
  closeFilter()
}
const resetFilters = () => {
  Object.keys(filters).forEach(key => delete filters[key])
  page.value = 1
  closeFilter()
}
const goToPage = nextPage => {
  page.value = Math.min(Math.max(1, nextPage), pageCount.value)
}

const stopFilterResize = () => {
  filterResizeState = null
  window.removeEventListener('pointermove', resizeFilterPanel)
  window.removeEventListener('pointerup', stopFilterResize)
}

const resizeFilterPanel = event => {
  if (!filterResizeState) return
  const left = Number.parseFloat(filterPanelStyle.left) || 8
  const top = Number.parseFloat(filterPanelStyle.top) || 8
  const maxWidth = Math.max(300, window.innerWidth - left - 8)
  const maxHeight = Math.max(220, window.innerHeight - top - 8)
  filterPanelSize.width = Math.max(300, Math.min(filterResizeState.width + event.clientX - filterResizeState.x, maxWidth))
  filterPanelSize.height = Math.max(220, Math.min(filterResizeState.height + event.clientY - filterResizeState.y, maxHeight))
  filterPanelStyle.width = `${Math.round(filterPanelSize.width)}px`
  filterPanelStyle.height = `${Math.round(filterPanelSize.height)}px`
}

const startFilterResize = event => {
  filterResizeState = { x: event.clientX, y: event.clientY, width: filterPanelSize.width, height: filterPanelSize.height }
  window.addEventListener('pointermove', resizeFilterPanel)
  window.addEventListener('pointerup', stopFilterResize)
}

onBeforeUnmount(stopFilterResize)
</script>

<style scoped>
.db-compare-page { flex: 1; min-width: 0; min-height: 0; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #f4f6f9; color: #303947; }
.page-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.page-toolbar { flex: 0 0 auto; padding: 20px 22px 0; }
.page-toolbar h2 { margin: 0 0 4px; font-size: 21px; }
.page-toolbar p { margin: 0; color: #778291; font-size: 13px; }
.page-toolbar p span { margin-left: 8px; padding: 2px 7px; border-radius: 10px; color: #a36b00; background: #fff4ce; }
.nav-button { display: none; }
.toolbar-actions { display: flex; gap: 8px; margin-left: auto; }
.toolbar-actions button, .pager button { padding: 7px 11px; border: 1px solid #d4dce5; border-radius: 4px; background: #fff; color: #44505e; }
.toolbar-actions .outlined { border-color: #168478; color: #107267; }
.toolbar-actions .primary, .pager .active { border-color: #168478; color: #fff; background: #168478; }
.table-shell { min-width: 0; min-height: 0; height: 0; flex: 1 1 auto; margin: 0 22px; overflow: auto; overscroll-behavior: contain; border: 1px solid #dbe2e9; border-radius: 5px; background: #fff; box-shadow: 0 3px 12px rgba(25, 42, 60, .06); scrollbar-gutter: stable; }
table { width: 100%; min-width: 1120px; border-collapse: collapse; font-size: 13px; }
table.is-fixed-layout { table-layout: fixed; }
thead.is-sticky { position: sticky; top: 0; z-index: 2; color: #fff; background: #176f74; }
th { padding: 12px 10px; text-align: left; white-space: nowrap; }
thead th.has-white-divider { border-right: 1px solid rgba(255, 255, 255, .78); }
th:nth-child(1) { width: 260px; }
th:nth-child(2) { width: 70px; }
th:nth-child(3) { width: 430px; }
th:nth-child(4) { width: 110px; }
th:nth-child(5) { width: 130px; }
th:nth-child(6) { width: 145px; }
th:nth-child(7) { width: 130px; }
.replay-header-filter-button { display: inline-grid; place-items: center; width: 18px; height: 18px; margin-left: 3px; padding: 0; border: 0; background: transparent; cursor: pointer; vertical-align: middle; }
.replay-header-filter-button i { display: block; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 7px solid #e9fff9; filter: drop-shadow(0 0 1px rgba(0,0,0,.7)); }
.replay-header-filter-button:hover i, .replay-header-filter-button:focus-visible i { border-top-color: #fff; }
.replay-header-filter-button.active i { border-top-color: #ffd166; }
.replay-header-filter-button:focus-visible { outline: 1px solid #fff; outline-offset: 1px; }
td { padding: 12px 10px; border-right: 1px solid #e2e8ee; border-bottom: 1px solid #e2e8ee; }
tbody tr:nth-child(even) { background: #edf7fb; }
.primary-column { position: sticky; left: 0; z-index: 1; }
thead .primary-column { z-index: 3; background: #176f74; }
tbody .primary-column { background: #fff; }
tbody tr:nth-child(even) .primary-column { background: #edf7fb; }
td strong, td small { display: block; }
td small { margin-top: 4px; color: #7b8795; }
.fields, .link { color: #1769aa; }
.field-content { overflow: hidden; line-height: 1.65; text-overflow: ellipsis; }
.field-list { display: flex; flex-wrap: wrap; gap: 6px 0; align-items: flex-start; }
.field-item { max-width: 100%; color: #1769aa; line-height: 1.65; overflow-wrap: anywhere; }
.field-separator { margin-right: 6px; }
.field-actions { display: flex; gap: 10px; margin-top: 5px; }
.field-action { padding: 0; border: 0; color: #168478; background: transparent; font-size: 12px; cursor: pointer; }
.fields:not(.is-expanded) .field-content { white-space: nowrap; }
.link { padding: 0 5px; border: 0; background: transparent; }
.replay-header-filter-panel { position: fixed; z-index: 1500; box-sizing: border-box; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 6px; padding: 8px; overflow: hidden; border: 1px solid #8e8e8e; border-radius: 3px; color: #222; background: #454545; box-shadow: 0 8px 22px rgba(0, 0, 0, .32); }
.replay-header-filter-panel > header, .replay-header-filter-panel > footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.replay-header-filter-panel > header { padding: 0 2px; color: #fff; }
.replay-header-filter-panel > header strong { font-size: 13px; }
.replay-header-filter-content { min-height: 0; display: grid; grid-template-rows: auto auto minmax(78px, 1fr); gap: 5px; padding: 7px; border-radius: 4px; background: #454545; }
.replay-header-filter-search { display: flex; gap: 5px; }
.replay-header-filter-search input { flex: 1; min-width: 0; height: 28px; padding: 0 8px; border: 1px solid #777; border-radius: 3px; color: #eee; background: #555; }
.replay-header-filter-search button { width: 28px; border: 1px solid #42b883; border-radius: 3px; color: #fff; background: #42b883; cursor: pointer; }
.replay-header-filter-actions { display: flex; gap: 6px; }
.replay-header-filter-actions button { padding: 3px 7px; border: 0; color: #ddd; background: transparent; cursor: pointer; font-size: 11px; }
.replay-header-filter-actions span { align-self: center; color: #c7c7c7; font-size: 11px; white-space: nowrap; }
.replay-header-filter-options { min-height: 0; overflow: auto; display: grid; align-content: start; gap: 1px; padding: 3px; border-radius: 3px; background: #555; }
.replay-header-filter-options label { display: flex; align-items: flex-start; gap: 6px; width: max-content; min-width: 100%; min-height: 23px; padding: 3px 4px; border-radius: 3px; color: #eee; font-size: 12px; line-height: 1.35; cursor: pointer; }
.replay-header-filter-options label:hover { background: #666; }
.replay-header-filter-options label span { white-space: nowrap; }
.replay-header-filter-options label em { position: sticky; right: 0; flex: 0 0 auto; min-width: 52px; margin-left: auto; padding-left: 10px; color: #c7c7c7; background: #555; text-align: right; font-style: normal; white-space: nowrap; }
.replay-header-filter-options label:hover em { background: #666; }
.replay-header-filter-options input { flex: 0 0 auto; margin-top: 2px; accent-color: #42d1a5; }
.replay-header-filter-options p { margin: 12px 4px; color: #bbb; text-align: center; font-size: 12px; }
.replay-header-filter-panel > footer { padding-top: 5px; border-top: 1px solid #666; }
.replay-header-filter-panel > footer > span { flex: 1; }
.replay-header-filter-panel > footer button { min-height: 25px; padding: 4px 9px; border: 1px solid #777; border-radius: 3px; color: #eee; background: #555; cursor: pointer; }
.replay-header-filter-panel > footer .primary { border-color: #42b883; background: #42b883; }
.replay-header-filter-panel > footer .replay-header-filter-clear { border-color: #777; color: #ffcf8a; background: #555; }
.replay-header-filter-resize-handle { position: absolute; right: 1px; bottom: 1px; width: 16px; height: 16px; padding: 0; border: 0; cursor: nwse-resize; touch-action: none; background: linear-gradient(135deg, transparent 0 42%, #bbb 43% 49%, transparent 50% 61%, #ddd 62% 68%, transparent 69%); }
.pager { flex: 0 0 auto; min-height: 52px; display: flex; justify-content: flex-end; align-items: center; gap: 14px; padding: 10px 22px; border-top: 1px solid #e2e8ee; background: #fff; font-size: 12px; color: #687381; }
.pager label { display: inline-flex; align-items: center; gap: 6px; }
.pager select { width: 66px; height: 31px; padding: 0 7px; border: 1px solid #d4dce5; border-radius: 4px; color: #44505e; background: #fff; }
.page-actions { display: flex; gap: 6px; }
.page-actions button { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; font-size: 20px; line-height: 1; }
@media (max-width: 760px) { .page-toolbar { align-items: flex-start; flex-wrap: wrap; padding: 12px 12px 0; } .table-shell { margin: 0 12px; } .pager { padding: 8px 12px; justify-content: space-between; } .nav-button { display: inline-block; } .toolbar-actions { width: 100%; margin-left: 0; } }
</style>
