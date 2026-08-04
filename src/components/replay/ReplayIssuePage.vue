<template>
  <section class="replay-page" aria-label="并行回放问题清单">
    <header class="replay-toolbar">
      <div>
        <h2>并行回放问题清单</h2>
        <p v-if="stats.importedAt">最近导入：{{ stats.importedAt }}</p>
      </div>
      <button class="replay-button replay-button-primary" type="button" data-testid="open-import" @click="openImport">
        <Upload :size="16" aria-hidden="true" />
        导入 Excel
      </button>
    </header>

    <div class="replay-summary" aria-label="汇总数据">
      <div class="replay-summary-card"><span>问题总数</span><strong>{{ stats.total ?? total }}</strong></div>
      <div class="replay-summary-card"><span>问题组数</span><strong>{{ stats.groupCount ?? 0 }}</strong></div>
      <div class="replay-summary-card"><span>沙箱问题</span><strong>{{ stats.sandboxCount ?? 0 }}</strong></div>
    </div>

    <form class="replay-filters" @submit.prevent="query">
      <label>
        <span>问题组</span>
        <select v-model="filters.groupName" data-testid="group-filter">
          <option value="">全部</option>
          <option v-for="group in options.groups" :key="group" :value="group">{{ group }}</option>
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
        <span>数据范围</span>
        <select v-model="filters.sandbox" data-testid="sandbox-filter">
          <option value="">全部</option>
          <option value="true">沙箱</option>
          <option value="false">非沙箱</option>
        </select>
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
          <tr><th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id" data-testid="replay-row">
            <td v-for="column in columns" :key="column.key" :title="displayColumn(column.key, row[column.key])">{{ displayColumn(column.key, row[column.key]) }}</td>
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
            <p>上传 Excel 文件后将替换当前回放问题清单。</p>
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
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ChevronLeft, ChevronRight, RotateCcw, Search, Upload, X } from 'lucide-vue-next'
import { getReplayIssueOptions, getReplayIssueStats, importReplayIssues, listReplayIssues } from '../../api/replayIssues.js'

const columns = [
  ['domain', '领域', '120px'], ['sequence_no', '序号', '72px'], ['batch_no', '批次号', '220px'],
  ['transaction_code', '交易码', '100px'], ['transaction_name', '交易名称', '180px'], ['issue_level', '问题级别', '100px'],
  ['registered_date', '登记日期', '108px'], ['field_name', '字段名称', '120px'], ['issue_description', '问题描述', '220px'],
  ['transaction_owner', '交易负责人', '112px'], ['issue_type', '问题类型', '112px'], ['initial_analysis', '初步分析', '180px'],
  ['final_solution', '最终解决方案', '180px'], ['resolved_date', '解决日期', '108px'], ['cooperation_group', '配合组', '120px'],
  ['resolver', '解决人', '100px'], ['serial_no', '流水号', '160px'], ['data_repair_date', '数据修复日期', '120px'],
  ['remark', '备注', '160px'], ['affected_transaction_count', '受影响交易数', '124px'], ['issue_id', '问题编号', '112px'],
  ['issue_key', '问题键', '180px'], ['historical_occurrence_count', '历史出现次数', '128px'],
  ['first_occurrence_date', '首次出现日期', '180px'], ['last_occurrence_date', '最近出现日期', '180px'], ['is_sandbox', '是否沙箱', '90px'],
].map(([key, label, width]) => ({ key, label, width }))

const filters = reactive({ groupName: '', issueLevel: '', issueType: '', sandbox: '', keyword: '' })
const options = reactive({ groups: [], issueLevels: [], issueTypes: [] })
const stats = reactive({ total: 0, groupCount: 0, sandboxCount: 0, importedAt: '' })
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

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function display(value) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function displayColumn(key, value) {
  if (key === 'is_sandbox') return value === true || value === 1 || value === 'true' || value === '1' ? '是' : '否'
  return display(value)
}

function requestParams() {
  return {
    groupName: filters.groupName || undefined,
    issueLevel: filters.issueLevel || undefined,
    issueType: filters.issueType || undefined,
    sandbox: filters.sandbox === '' ? undefined : filters.sandbox === 'true',
    keyword: filters.keyword || undefined,
    limit: pageSize.value,
    offset: page.value * pageSize.value,
  }
}

async function loadList() {
  loading.value = true
  error.value = ''
  try {
    const result = await listReplayIssues(requestParams())
    items.value = result.items || []
    total.value = result.total || 0
  } catch (cause) {
    items.value = []
    total.value = 0
    error.value = `加载失败：${cause?.message || cause}`
  } finally {
    loading.value = false
  }
}

async function loadMetadata() {
  try {
    const [nextOptions, nextStats] = await Promise.all([getReplayIssueOptions(), getReplayIssueStats()])
    Object.assign(options, nextOptions || {})
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
  Object.assign(filters, { groupName: '', issueLevel: '', issueType: '', sandbox: '', keyword: '' })
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
    importMessage.value = `导入完成：${result.totalRows ?? 0} 条；沙箱 ${result.sandboxRows ?? 0} 条；非沙箱 ${result.nonSandboxRows ?? 0} 条`
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

.replay-summary {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 180px));
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
}
.replay-summary-card span { color: var(--text-muted, #6b7280); font-size: 12px; line-height: 16px; }
.replay-summary-card strong { font-size: 20px; line-height: 26px; font-variant-numeric: tabular-nums; }

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
.replay-icon-button { width: 32px; min-width: 32px; display: inline-grid; place-items: center; padding: 0; }
.replay-button-primary { border-color: var(--text-active, #3b5adb); color: var(--btn-primary-text, #fff); background: var(--text-active, #3b5adb); }
.replay-button:disabled, .replay-icon-button:disabled { cursor: not-allowed; opacity: .48; }

.replay-table-viewport { min-height: 0; flex: 1 1 auto; overflow: auto; padding: 0 20px; }
.replay-table { min-width: 3000px; table-layout: fixed; border-collapse: separate; border-spacing: 0; width: 100%; font-size: 12px; }
.replay-table thead th { position: sticky; top: 0; z-index: 2; background: var(--replay-teal); color: #fff; }
.replay-table th, .replay-table td { height: 34px; padding: 7px 10px; text-align: left; vertical-align: middle; border-right: 1px solid var(--border, #e8edf5); border-bottom: 1px solid var(--border, #e8edf5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.replay-table th:first-child, .replay-table td:first-child { border-left: 1px solid var(--border, #e8edf5); }
.replay-table tbody tr:nth-child(even) td { background: var(--replay-row-alt); }
.replay-table tbody tr:nth-child(odd) td { background: var(--bg-card, #fff); }
.replay-state { text-align: center !important; color: var(--text-muted, #6b7280); }
.replay-error { color: var(--c-error-code-text, #cf1124); }

.replay-pager { min-height: 52px; display: flex; align-items: center; justify-content: flex-end; gap: 14px; padding: 10px 20px; border-top: 1px solid var(--border, #e8edf5); background: var(--bg-card, #fff); color: var(--text-muted, #6b7280); font-size: 12px; }
.replay-pager label { display: inline-flex; align-items: center; gap: 6px; }
.replay-pager select { width: 66px; height: 30px; border: 1px solid var(--border, #e8edf5); border-radius: 4px; color: var(--text-primary, #1f2937); background: var(--bg-input, #fff); }
.replay-page-actions { display: flex; gap: 6px; }

.replay-modal-mask { position: fixed; z-index: 30; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(13, 20, 36, .42); }
.replay-import-modal { width: min(460px, 100%); display: grid; gap: 16px; padding: 20px; border: 1px solid var(--border, #e8edf5); border-radius: 6px; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: 0 16px 42px rgba(13, 20, 36, .24); }
.replay-import-modal header, .replay-import-modal footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.replay-import-modal footer { justify-content: flex-end; }
.replay-file-field small { color: var(--text-muted, #6b7280); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.replay-import-message { margin: 0 !important; padding: 8px 10px; border: 1px solid var(--border, #e8edf5); border-radius: 4px; background: var(--bg-badge, #f0f2f5); color: var(--text-secondary, #374151) !important; }
.replay-import-message.is-error { color: var(--c-error-code-text, #cf1124) !important; }

[data-theme="dark"] .replay-page { --replay-teal: #145c67; --replay-row-alt: rgba(126, 184, 255, .07); }

@media (max-width: 760px) {
  .replay-toolbar, .replay-filters, .replay-pager { padding-left: 12px; padding-right: 12px; }
  .replay-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); padding-left: 12px; padding-right: 12px; }
  .replay-summary-card { padding-left: 8px; padding-right: 8px; }
  .replay-pager { justify-content: space-between; gap: 8px; }
}
</style>
