<template>
  <main class="db-compare-page">
    <header class="page-toolbar">
      <button class="nav-button" type="button" aria-label="打开导航" @click="$emit('toggleNavigation')">☰</button>
      <div>
        <h2>回放数据库比对字段登记</h2>
        <p>共 327 张表 · 2,846 个比对字段 <span>Mock 数据</span></p>
      </div>
      <div class="toolbar-actions">
        <button type="button">重置筛选条件</button>
        <button type="button" class="outlined">初始化导入</button>
        <button type="button" class="primary">＋ 新增登记</button>
      </div>
    </header>

    <section class="table-shell">
      <table class="is-fixed-layout">
        <thead data-testid="database-comparison-table-head" class="is-sticky">
          <tr>
            <th>序号</th>
            <th><button data-testid="database-comparison-header-filter">领域 ▼</button></th>
            <th><button data-testid="database-comparison-header-filter">表英文名 / 中文名 ▼</button></th>
            <th><button data-testid="database-comparison-header-filter">比对字段 ▼</button></th>
            <th><button data-testid="database-comparison-header-filter">负责人 ▼</button></th>
            <th><button data-testid="database-comparison-header-filter">归属大组 ▼</button></th>
            <th><button data-testid="database-comparison-header-filter">登记日期 ▼</button></th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.tableName">
            <td>{{ index + 1 }}</td>
            <td>{{ row.domain }}</td>
            <td><strong>{{ row.tableName }}</strong><small>{{ row.tableComment }}</small></td>
            <td
              class="fields"
              :class="{ 'is-expanded': isExpanded(row.tableName) }"
              :data-testid="`fields-${row.tableName}`"
            >
              <div v-if="isExpanded(row.tableName)" class="field-list">
                <span v-for="field in row.fields" :key="field.name" class="field-item">{{ formatField(field) }}</span>
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
    <footer class="pager"><button disabled>‹</button><button class="active">1</button><button>2</button><button>3</button><span>每页 20 条，共 327 条</span></footer>
  </main>
</template>

<script setup>
import { ref } from 'vue'

defineEmits(['toggleNavigation'])

const rows = [
  { domain: '存款', tableName: 'kdpa_cb_acct_fzn_cntl_inf', tableComment: '对公存款账户冻结控制信息', fields: [{ name: 'fzn_cntl_id', comment: '冻结控制编号' }, { name: 'lglpern_cd', comment: '' }, { name: 'fzn_cntl_amt', comment: '冻结金额' }, { name: 'currency_cd', comment: '币种' }, { name: 'effective_dt', comment: '生效日期' }, { name: 'acct_status', comment: '账户状态' }], owner: '周皓', group: '存款组', date: '2026-09-07' },
  { domain: '存款', tableName: 'kdpl_cb_acct_fzn_cntl_oprn_detl', tableComment: '对公存款账户冻结控制操作明细', fields: [{ name: 'fzn_cntl_oprn_sn', comment: '冻结操作序号' }, { name: 'txn_dt', comment: '交易日期' }, { name: 'cncl_fzn_dectrl_amt', comment: '取消冻结金额' }, { name: 'operator_id', comment: '' }], owner: '周皓', group: '存款组', date: '2026-09-07' },
  { domain: '贷款', tableName: 'klna_ln_acct_base_info', tableComment: '贷款账户基础信息', fields: [{ name: 'loan_acct_no', comment: '贷款账号' }, { name: 'customer_no', comment: '客户号' }, { name: 'product_code', comment: '' }, { name: 'loan_status', comment: '贷款状态' }], owner: '李明', group: '贷款组', date: '2026-09-08' },
]

const expandedTables = ref(new Set())
const copiedTable = ref('')

const formatField = field => field.comment?.trim()
  ? `${field.name}(${field.comment.trim()})`
  : field.name

const allFields = row => row.fields.map(formatField).join('、')

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
th:first-child, td:first-child { width: 54px; text-align: center; }
th:nth-child(2) { width: 70px; }
th:nth-child(3) { width: 240px; }
th:nth-child(4) { width: 430px; }
th:nth-child(5) { width: 110px; }
th:nth-child(6) { width: 130px; }
th:nth-child(7) { width: 145px; }
th:nth-child(8) { width: 130px; }
th button { width: 100%; padding: 12px 10px; border: 0; color: inherit; background: transparent; text-align: left; font-weight: 600; }
td { padding: 12px 10px; border-right: 1px solid #e2e8ee; border-bottom: 1px solid #e2e8ee; }
tbody tr:nth-child(even) { background: #edf7fb; }
td strong, td small { display: block; }
td small { margin-top: 4px; color: #7b8795; }
.fields, .link { color: #1769aa; }
.field-content { overflow: hidden; line-height: 1.65; text-overflow: ellipsis; }
.field-list { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: flex-start; }
.field-item { max-width: 100%; color: #1769aa; line-height: 1.65; overflow-wrap: anywhere; }
.field-actions { display: flex; gap: 10px; margin-top: 5px; }
.field-action { padding: 0; border: 0; color: #168478; background: transparent; font-size: 12px; cursor: pointer; }
.fields:not(.is-expanded) .field-content { white-space: nowrap; }
.link { padding: 0 5px; border: 0; background: transparent; }
.pager { display: flex; justify-content: flex-end; align-items: center; gap: 7px; margin-top: 12px; font-size: 12px; color: #687381; }
@media (max-width: 760px) { .db-compare-page { padding: 12px; } .nav-button { display: inline-block; } .page-toolbar { align-items: flex-start; flex-wrap: wrap; } .toolbar-actions { width: 100%; margin-left: 0; } }
</style>
