<template>
  <main class="db-compare-page">
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

    <section class="table-shell">
      <table class="is-fixed-layout">
        <thead data-testid="database-comparison-table-head" class="is-sticky">
          <tr>
            <th
              v-for="column in filterColumns"
              :key="column.key"
              :class="{ 'primary-column': column.key === 'tableName' }"
            >
              <button
                data-testid="database-comparison-header-filter"
                :data-filter-key="column.key"
                :class="{ active: filters[column.key]?.length }"
                @click.stop="openFilter(column.key)"
              >{{ column.label }} ▼</button>
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

    <section v-if="activeFilterKey" class="header-filter-panel" data-testid="header-filter-panel">
      <header><strong>筛选{{ activeFilterLabel }}</strong><button type="button" aria-label="关闭筛选" @click="closeFilter">×</button></header>
      <div class="header-filter-search"><input v-model.trim="filterSearch" data-testid="header-filter-search" type="search" placeholder="模糊搜索" /></div>
      <div class="header-filter-actions"><button type="button" @click="selectAllOptions">全选</button><button type="button" @click="invertOptions">反选</button><span>筛选数（{{ visibleFilterOptions.length }}）</span><span>计数（{{ draftMatchedCount }}）</span></div>
      <div class="header-filter-options">
        <label v-for="option in visibleFilterOptions" :key="option.value" data-testid="header-filter-option">
          <input v-model="filterDraft" type="checkbox" :value="option.value" />
          <span>{{ option.value }}</span><em>（{{ option.count }}）</em>
        </label>
        <p v-if="!visibleFilterOptions.length">暂无选项</p>
      </div>
      <footer><button type="button" @click="clearActiveFilter">清空筛选</button><span></span><button type="button" @click="closeFilter">取消</button><button type="button" data-testid="apply-header-filter" class="primary" @click="applyFilter">确定</button></footer>
    </section>

    <footer class="pager">
      <button type="button" data-testid="previous-page" :disabled="page === 1" @click="goToPage(page - 1)">‹</button>
      <button v-for="pageNumber in pageNumbers" :key="pageNumber" type="button" :class="{ active: pageNumber === page }" @click="goToPage(pageNumber)">{{ pageNumber }}</button>
      <button type="button" data-testid="next-page" :disabled="page === pageCount" @click="goToPage(page + 1)">›</button>
      <select v-model.number="pageSize" data-testid="page-size" @change="page = 1"><option :value="20">20</option><option :value="50">50</option><option :value="100">100</option></select>
      <span data-testid="page-summary">每页 {{ pageSize }} 条，第 {{ page }} / {{ pageCount }} 页，共 {{ filteredRows.length }} 条</span>
    </footer>
  </main>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'

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
const filterSearch = ref('')
const filterDraft = ref([])
const page = ref(1)
const pageSize = ref(20)

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
const pageNumbers = computed(() => {
  const start = Math.max(1, Math.min(page.value - 2, pageCount.value - 4))
  return Array.from({ length: Math.min(5, pageCount.value) }, (_, index) => start + index)
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

const openFilter = key => {
  activeFilterKey.value = key
  filterSearch.value = ''
  filterDraft.value = [...(filters[key] || [])]
}

const closeFilter = () => {
  activeFilterKey.value = ''
  filterSearch.value = ''
  filterDraft.value = []
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
</script>

<style scoped>
.db-compare-page { flex: 1; min-width: 0; padding: 20px 22px; overflow: auto; background: #f4f6f9; color: #303947; }
.page-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.page-toolbar h2 { margin: 0 0 4px; font-size: 21px; }
.page-toolbar p { margin: 0; color: #778291; font-size: 13px; }
.page-toolbar p span { margin-left: 8px; padding: 2px 7px; border-radius: 10px; color: #a36b00; background: #fff4ce; }
.nav-button { display: none; }
.toolbar-actions { display: flex; gap: 8px; margin-left: auto; }
.toolbar-actions button, .pager button { padding: 7px 11px; border: 1px solid #d4dce5; border-radius: 4px; background: #fff; color: #44505e; }
.toolbar-actions .outlined { border-color: #168478; color: #107267; }
.toolbar-actions .primary, .pager .active { border-color: #168478; color: #fff; background: #168478; }
.table-shell { overflow: auto; border: 1px solid #dbe2e9; border-radius: 5px; background: #fff; box-shadow: 0 3px 12px rgba(25, 42, 60, .06); }
table { width: 100%; min-width: 1120px; border-collapse: collapse; font-size: 13px; }
table.is-fixed-layout { table-layout: fixed; }
thead.is-sticky { position: sticky; top: 0; z-index: 2; color: #fff; background: #176f74; }
th { padding: 0; text-align: left; white-space: nowrap; }
th:nth-child(1) { width: 260px; }
th:nth-child(2) { width: 70px; }
th:nth-child(3) { width: 430px; }
th:nth-child(4) { width: 110px; }
th:nth-child(5) { width: 130px; }
th:nth-child(6) { width: 145px; }
th:nth-child(7) { width: 130px; }
th button { width: 100%; padding: 12px 10px; border: 0; color: inherit; background: transparent; text-align: left; font-weight: 600; }
th button.active { color: #ffd166; }
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
.header-filter-panel { position: fixed; z-index: 1500; top: 138px; right: 28px; display: grid; grid-template-rows: auto auto auto minmax(110px, 1fr) auto; gap: 7px; width: 340px; max-height: 430px; padding: 9px; border: 1px solid #7c8589; border-radius: 4px; color: #eee; background: #454b4d; box-shadow: 0 9px 26px rgba(0, 0, 0, .3); }
.header-filter-panel > header, .header-filter-panel > footer { display: flex; align-items: center; gap: 8px; }
.header-filter-panel > header { justify-content: space-between; }
.header-filter-panel > header button { border: 0; color: #fff; background: transparent; font-size: 20px; cursor: pointer; }
.header-filter-search input { box-sizing: border-box; width: 100%; height: 30px; padding: 0 8px; border: 1px solid #737b7e; border-radius: 3px; color: #fff; background: #555d60; }
.header-filter-actions { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #c9d0d2; }
.header-filter-actions button { padding: 2px 4px; border: 0; color: #dce4e6; background: transparent; cursor: pointer; }
.header-filter-options { min-height: 110px; overflow: auto; padding: 4px; border-radius: 3px; background: #555d60; }
.header-filter-options label { display: flex; align-items: flex-start; gap: 6px; min-height: 24px; padding: 3px 4px; border-radius: 3px; font-size: 12px; cursor: pointer; }
.header-filter-options label:hover { background: #687174; }
.header-filter-options label span { min-width: 0; overflow-wrap: anywhere; }
.header-filter-options label em { margin-left: auto; color: #c0c8ca; font-style: normal; white-space: nowrap; }
.header-filter-options input { flex: 0 0 auto; margin-top: 2px; accent-color: #42b883; }
.header-filter-options p { color: #c0c8ca; text-align: center; }
.header-filter-panel > footer { padding-top: 7px; border-top: 1px solid #687174; }
.header-filter-panel > footer span { flex: 1; }
.header-filter-panel > footer button { padding: 5px 10px; border: 1px solid #737b7e; border-radius: 3px; color: #eee; background: #555d60; cursor: pointer; }
.header-filter-panel > footer .primary { border-color: #168478; background: #168478; }
.pager { display: flex; justify-content: flex-end; align-items: center; gap: 7px; margin-top: 12px; font-size: 12px; color: #687381; }
.pager select { height: 31px; padding: 0 7px; border: 1px solid #d4dce5; border-radius: 4px; color: #44505e; background: #fff; }
@media (max-width: 760px) { .db-compare-page { padding: 12px; } .nav-button { display: inline-block; } .page-toolbar { align-items: flex-start; flex-wrap: wrap; } .toolbar-actions { width: 100%; margin-left: 0; } }
</style>
