<template>
  <div v-if="open" class="history-backdrop" role="presentation">
    <section class="history-dialog" role="dialog" aria-modal="true" aria-label="版本历史">
      <header class="history-header">
        <div>
          <h3>版本历史</h3>
          <p>查看已生成的只读配置快照</p>
        </div>
        <button
          type="button"
          class="icon-button"
          aria-label="关闭版本历史"
          data-testid="close-version-history"
          @click="emit('close')"
        >×</button>
      </header>

      <div class="history-body">
        <aside class="version-pane">
          <div class="pane-title">
            <strong>生成版本</strong>
            <span>{{ versions.length }}</span>
          </div>
          <div class="version-list" data-testid="version-history-list">
            <button
              v-for="version in versions"
              :key="version.versionNo"
              type="button"
              class="version-item"
              :class="{ active: version.versionNo === selectedVersionNo }"
              :data-testid="`version-item-${version.versionNo}`"
              @click="selectVersion(version.versionNo)"
            >
              <span class="version-number">{{ version.versionNo }}</span>
              <span v-if="version.latest" class="latest-badge">最新</span>
              <small>{{ version.generatedName || '-' }} · {{ formatDateTime(version.generatedAt) }}</small>
              <small>{{ version.tableCount }} 张表 · {{ version.fieldCount }} 个字段</small>
            </button>
            <p v-if="!loadingVersions && !versions.length" class="empty-state">暂无历史版本</p>
          </div>
        </aside>

        <main class="snapshot-pane">
          <div class="snapshot-heading">
            <div>
              <strong>{{ selectedVersionNo || '未选择版本' }}</strong>
              <span>不可编辑的生成快照</span>
            </div>
            <span>共 {{ snapshot.total }} 张表</span>
          </div>

          <div class="filter-section">
          <form class="history-filters" @submit.prevent="applyFilters">
            <label>
              <span>表名</span>
              <input v-model.trim="draftFilters.tableKeyword" data-testid="history-table-keyword" type="search" placeholder="英文名 / 中文名" />
            </label>
            <label>
              <span>字段</span>
              <input v-model.trim="draftFilters.fieldKeyword" data-testid="history-field-keyword" type="search" placeholder="字段英文名" />
            </label>
            <label>
              <span>领域</span>
              <input v-model.trim="draftFilters.domain" data-testid="history-domain" type="search" list="history-domain-options" placeholder="选择领域" />
              <datalist id="history-domain-options"><option v-for="option in filterOptions.domainName" :key="option.value" :value="option.value">{{ option.label }}</option></datalist>
            </label>
            <label>
              <span>修订人</span>
              <input v-model.trim="draftFilters.reviserEmpNo" data-testid="history-reviser" type="search" list="history-reviser-options" placeholder="选择姓名 / 工号" />
              <datalist id="history-reviser-options"><option v-for="option in filterOptions.reviser" :key="option.value" :value="option.value">{{ option.label }}</option></datalist>
            </label>
            <label>
              <span>小组负责人</span>
              <input v-model.trim="draftFilters.groupOwnerEmpNo" data-testid="history-group-owner" type="search" list="history-group-owner-options" placeholder="选择姓名 / 工号" />
              <datalist id="history-group-owner-options"><option v-for="option in filterOptions.groupOwner" :key="option.value" :value="option.value">{{ option.label }}</option></datalist>
            </label>
            <label>
              <span>登记日期</span>
              <input v-model="draftFilters.registeredDate" data-testid="history-registered-date" type="date" />
            </label>
            <div class="filter-actions">
              <button type="button" class="outlined" @click="resetFilters">重置</button>
              <button type="button" class="primary" data-testid="apply-history-filters" @click="applyFilters">查询</button>
              <button
                type="button"
                class="primary script-action"
                :class="{ generated: scriptStatus.generated }"
                :disabled="!selectedVersionNo || loadingScriptStatus || generatingScript"
                data-testid="config-script-action"
                @click="handleConfigScript"
              >
                <span v-if="scriptStatus.generated && !generatingScript" aria-hidden="true">↓</span>
                {{ configScriptActionText }}
              </button>
            </div>
          </form>

          <div v-if="scriptError" class="script-error" data-testid="config-script-errors" role="alert">
            <strong>{{ scriptError }}</strong>
            <ul v-if="scriptValidationErrors.length">
              <li v-for="(item, index) in scriptValidationErrors" :key="`${item.tableName}-${item.fieldName}-${index}`">
                {{ item.tableName || '-' }}<template v-if="item.fieldName"> / {{ item.fieldName }}</template>：{{ item.reason }}
              </li>
            </ul>
          </div>
          </div>

          <div class="snapshot-table-shell">
            <table data-testid="version-snapshot-table">
              <thead>
                <tr>
                  <th>表英文名 / 中文名</th>
                  <th>领域</th>
                  <th>比对字段</th>
                  <th>查询条件</th>
                  <th>修订人</th>
                  <th>小组负责人</th>
                  <th>登记日期</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in snapshot.items" :key="`${row.sourceRegistrationId}-${row.tableName}`">
                  <td><strong>{{ row.tableName }}</strong><small>{{ row.tableComment || '-' }}</small></td>
                  <td>{{ row.domainName || '-' }}</td>
                  <td class="field-cell">
                    <span v-for="(field, index) in row.fields || []" :key="`${field.columnName}-${field.comparisonOrder}`">
                      {{ formatField(field) }}<b v-if="field.primaryKey">主键</b><i v-if="index < row.fields.length - 1">、</i>
                    </span>
                  </td>
                  <td
                    class="query-condition-cell"
                    :data-testid="`history-query-condition-${row.tableName}`"
                    :title="queryConditionText(row)"
                  >{{ queryConditionText(row) }}</td>
                  <td>{{ personLabel(row.reviserName, row.reviserUsername, row.reviserEmpNo) }}</td>
                  <td>{{ personLabel(row.groupOwnerName, row.groupOwnerUsername, row.groupOwnerEmpNo) }}</td>
                  <td>{{ row.registeredDate || '-' }}</td>
                </tr>
                <tr v-if="!loadingSnapshot && !snapshot.items.length">
                  <td colspan="7" class="empty-state">暂无快照数据</td>
                </tr>
              </tbody>
            </table>
          </div>

          <footer class="history-pager">
            <span>共 {{ snapshot.total }} 条，第 {{ snapshot.page + 1 }} 页</span>
            <label>每页
              <select v-model.number="pageSize" @change="changePageSize">
                <option :value="50">50</option>
                <option :value="100">100</option>
                <option :value="200">200</option>
              </select>
              条
            </label>
            <button type="button" :disabled="snapshot.page <= 0 || loadingSnapshot" @click="goToPage(snapshot.page - 1)">‹</button>
            <button type="button" data-testid="history-next-page" :disabled="loadingSnapshot" @click="goToPage(snapshot.page + 1)">›</button>
          </footer>
        </main>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  downloadVersionConfigScript,
  generateVersionConfigScript,
  loadVersionConfigScriptStatus,
  loadVersionHeaderFilterOptions,
  loadVersions,
  searchVersionSnapshot,
} from '../../api/replayDatabaseComparison.js'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])

const versions = ref([])
const selectedVersionNo = ref('')
const loadingVersions = ref(false)
const loadingSnapshot = ref(false)
const loadingScriptStatus = ref(false)
const generatingScript = ref(false)
const scriptStatus = ref({ generated: false })
const scriptError = ref('')
const scriptValidationErrors = ref([])
let scriptStatusRequest = 0
const pageSize = ref(50)
const snapshot = reactive({ items: [], page: 0, size: 50, total: 0 })
const filterOptions = reactive({ domainName: [], reviser: [], groupOwner: [] })
const draftFilters = reactive({
  tableKeyword: '',
  fieldKeyword: '',
  domain: '',
  reviserEmpNo: '',
  groupOwnerEmpNo: '',
  registeredDate: '',
})
const appliedFilters = reactive({})

const formatDateTime = value => value ? value.replace('T', ' ') : '-'
const formatField = field => field.columnComment
  ? `${field.columnName}(${field.columnComment})`
  : field.columnName
const queryConditionText = row => {
  const parts = []
  const whereSql = String(row?.whereSql || '').trim().replace(/^where\s+/i, '')
  if (whereSql) parts.push(`WHERE ${whereSql}`)
  if (row?.compareLimit !== null && row?.compareLimit !== undefined && row?.compareLimit !== '') {
    const primaryKeys = [...(row.fields || [])]
      .filter(field => field.primaryKey)
      .sort((left, right) => (left.primaryKeyOrder ?? left.comparisonOrder ?? Number.MAX_SAFE_INTEGER)
        - (right.primaryKeyOrder ?? right.comparisonOrder ?? Number.MAX_SAFE_INTEGER))
      .map(field => field.columnName)
    if (primaryKeys.length) parts.push(`ORDER BY ${primaryKeys.join(', ')}`)
    parts.push(`LIMIT ${row.compareLimit}`)
  }
  return parts.join(' ') || '全表'
}
const personLabel = (name, username, fallback) => {
  const account = username || fallback
  if (!name && !account) return '-'
  if (!name || !account || name === account) return name || account
  return `${name}(${account})`
}

const configScriptActionText = computed(() => {
  if (generatingScript.value) return '生成中…'
  if (loadingScriptStatus.value) return '状态加载中…'
  return scriptStatus.value.generated ? '下载配置脚本' : '生成配置脚本'
})

const criteria = page => ({
  ...appliedFilters,
  page,
  size: pageSize.value,
})

const loadSnapshot = async page => {
  if (!selectedVersionNo.value) return
  loadingSnapshot.value = true
  try {
    const result = await searchVersionSnapshot(selectedVersionNo.value, criteria(page))
    snapshot.items = result?.items || []
    snapshot.page = result?.page ?? page
    snapshot.size = result?.size ?? pageSize.value
    snapshot.total = result?.total ?? 0
  } finally {
    loadingSnapshot.value = false
  }
}

const loadFilterOptions = async () => {
  if (!selectedVersionNo.value) return
  await Promise.all(Object.keys(filterOptions).map(async targetColumn => {
    try {
      const result = await loadVersionHeaderFilterOptions(selectedVersionNo.value, {
        targetColumn,
        keyword: '',
        limit: 200,
      })
      filterOptions[targetColumn] = result?.options || []
    } catch (_) {
      filterOptions[targetColumn] = []
    }
  }))
}

const loadScriptStatus = async versionNo => {
  const requestId = ++scriptStatusRequest
  loadingScriptStatus.value = true
  try {
    const result = await loadVersionConfigScriptStatus(versionNo)
    if (requestId !== scriptStatusRequest || versionNo !== selectedVersionNo.value) return
    scriptStatus.value = result || { generated: false }
  } catch (error) {
    if (requestId !== scriptStatusRequest || versionNo !== selectedVersionNo.value) return
    scriptStatus.value = { generated: false }
    scriptError.value = error?.message || '配置脚本状态加载失败'
  } finally {
    if (requestId === scriptStatusRequest) loadingScriptStatus.value = false
  }
}

const loadHistory = async () => {
  loadingVersions.value = true
  try {
    const result = await loadVersions(0, 20)
    versions.value = [...(result?.items || [])].sort((left, right) => right.versionNo.localeCompare(left.versionNo))
    selectedVersionNo.value = versions.value.find(version => version.latest)?.versionNo || versions.value[0]?.versionNo || ''
    snapshot.items = []
    snapshot.page = 0
    snapshot.total = 0
    scriptStatus.value = { generated: false }
    scriptError.value = ''
    scriptValidationErrors.value = []
    if (selectedVersionNo.value) {
      await Promise.all([
        loadSnapshot(0),
        loadFilterOptions(),
        loadScriptStatus(selectedVersionNo.value),
      ])
    }
  } finally {
    loadingVersions.value = false
  }
}

const selectVersion = async versionNo => {
  if (versionNo === selectedVersionNo.value) return
  selectedVersionNo.value = versionNo
  scriptStatus.value = { generated: false }
  scriptError.value = ''
  scriptValidationErrors.value = []
  await Promise.all([loadSnapshot(0), loadFilterOptions(), loadScriptStatus(versionNo)])
}

const handleConfigScript = async () => {
  if (!selectedVersionNo.value || generatingScript.value || loadingScriptStatus.value) return
  scriptError.value = ''
  scriptValidationErrors.value = []
  try {
    if (scriptStatus.value.generated) {
      await downloadVersionConfigScript(selectedVersionNo.value)
      return
    }
    generatingScript.value = true
    const versionNo = selectedVersionNo.value
    await generateVersionConfigScript(versionNo)
    if (versionNo === selectedVersionNo.value) await loadScriptStatus(versionNo)
  } catch (error) {
    scriptError.value = error?.message || '配置脚本处理失败'
    scriptValidationErrors.value = error?.code === 'CONFIG_SCRIPT_VALIDATION_FAILED'
      ? [...(error?.data?.errors || [])]
      : []
  } finally {
    generatingScript.value = false
  }
}

const applyFilters = async () => {
  Object.keys(appliedFilters).forEach(key => delete appliedFilters[key])
  if (draftFilters.tableKeyword) appliedFilters.tableKeyword = draftFilters.tableKeyword
  if (draftFilters.fieldKeyword) appliedFilters.fieldKeyword = draftFilters.fieldKeyword
  appliedFilters.domains = draftFilters.domain ? [draftFilters.domain] : []
  appliedFilters.reviserEmpNos = draftFilters.reviserEmpNo ? [draftFilters.reviserEmpNo] : []
  appliedFilters.groupOwnerEmpNos = draftFilters.groupOwnerEmpNo ? [draftFilters.groupOwnerEmpNo] : []
  appliedFilters.registeredDateFrom = draftFilters.registeredDate || null
  appliedFilters.registeredDateTo = draftFilters.registeredDate || null
  await loadSnapshot(0)
}

const resetFilters = async () => {
  Object.keys(draftFilters).forEach(key => { draftFilters[key] = '' })
  Object.keys(appliedFilters).forEach(key => delete appliedFilters[key])
  await loadSnapshot(0)
}

const goToPage = async page => {
  if (page < 0) return
  await loadSnapshot(page)
}

const changePageSize = async () => { await loadSnapshot(0) }

watch(() => props.open, value => {
  if (value) loadHistory()
}, { immediate: true })
</script>

<style scoped>
.history-backdrop { position: fixed; inset: 0; z-index: 1600; display: grid; place-items: center; padding: 24px; background: rgba(18, 29, 43, .48); }
.history-dialog { width: min(1500px, 96vw); height: min(840px, 92vh); display: grid; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; border-radius: 8px; background: #f4f7f9; box-shadow: 0 22px 60px rgba(15, 30, 45, .28); }
.history-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #dfe6ec; background: #fff; }
.history-header h3, .history-header p { margin: 0; }
.history-header h3 { color: #25313d; font-size: 18px; }
.history-header p { margin-top: 3px; color: #7b8793; font-size: 12px; }
.icon-button { width: 32px; height: 32px; border: 1px solid #d6dee5; border-radius: 4px; color: #697580; background: #fff; font-size: 22px; cursor: pointer; }
.history-body { min-height: 0; display: grid; grid-template-columns: 238px minmax(0, 1fr); }
.version-pane { min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); border-right: 1px solid #dfe6ec; background: #fff; }
.pane-title { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 10px; color: #465361; font-size: 13px; }
.pane-title span { color: #89939e; }
.version-list { min-height: 0; overflow: auto; padding: 0 10px 14px; }
.version-item { position: relative; width: 100%; display: grid; gap: 4px; margin-bottom: 6px; padding: 11px 12px; border: 1px solid transparent; border-radius: 5px; color: #52606d; background: #f7f9fa; text-align: left; cursor: pointer; }
.version-item:hover { border-color: #bfcdd7; }
.version-item.active { border-color: #168478; background: #edf8f6; box-shadow: inset 3px 0 #168478; }
.version-number { color: #24313d; font-weight: 700; }
.version-item small { color: #7b8793; }
.latest-badge { position: absolute; top: 9px; right: 9px; padding: 2px 6px; border-radius: 10px; color: #087267; background: #d9f2ed; font-size: 10px; }
.snapshot-pane { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; }
.filter-section { min-width: 0; }
.snapshot-heading { display: flex; align-items: center; justify-content: space-between; padding: 13px 18px; color: #687581; }
.snapshot-heading div { display: flex; align-items: baseline; gap: 10px; }
.snapshot-heading strong { color: #25313d; }
.snapshot-heading span { font-size: 12px; }
.history-filters { display: flex; align-items: end; gap: 9px; padding: 0 18px 12px; }
.history-filters label { min-width: 0; flex: 1 1 150px; display: grid; gap: 4px; color: #697581; font-size: 11px; }
.history-filters input, .history-filters select { height: 32px; min-width: 0; padding: 0 9px; border: 1px solid #d4dce5; border-radius: 4px; color: #36424e; background: #fff; }
.filter-actions { flex: 0 0 auto; display: flex; gap: 7px; }
.filter-actions button { height: 32px; padding: 0 13px; border: 1px solid #ccd6de; border-radius: 4px; background: #fff; cursor: pointer; }
.filter-actions .primary { border-color: #168478; color: #fff; background: #168478; }
.filter-actions .script-action { min-width: 116px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; }
.filter-actions .script-action.generated { border-color: #506579; background: #506579; }
.filter-actions .script-action:disabled { cursor: not-allowed; opacity: .62; }
.filter-actions .script-action:disabled:not(.generated) { cursor: wait; }
.script-error { margin: 0 18px 10px; padding: 9px 12px; border: 1px solid #efb4b4; border-radius: 4px; color: #a63333; background: #fff1f1; font-size: 12px; }
.script-error strong { display: block; }
.script-error ul { max-height: 92px; margin: 6px 0 0; padding-left: 20px; overflow: auto; }
.script-error li + li { margin-top: 3px; }
.snapshot-table-shell { min-height: 0; margin: 0 18px; overflow: auto; border: 1px solid #dbe2e9; border-radius: 5px; background: #fff; }
table { width: 100%; min-width: 1080px; border-collapse: collapse; table-layout: fixed; color: #465361; font-size: 12px; }
th { position: sticky; top: 0; z-index: 1; padding: 10px; border-right: 1px solid rgba(255,255,255,.72); color: #fff; background: #168478; text-align: left; }
th:nth-child(1) { width: 190px; } th:nth-child(2) { width: 90px; } th:nth-child(3) { width: 330px; } th:nth-child(4) { width: 180px; } th:nth-child(5), th:nth-child(6) { width: 105px; } th:nth-child(7) { width: 100px; }
td { padding: 10px; border-right: 1px solid #edf1f4; border-bottom: 1px solid #e6ebef; vertical-align: top; overflow-wrap: anywhere; }
td strong, td small { display: block; }
td small { margin-top: 3px; color: #86919c; }
.field-cell span { display: inline; line-height: 1.8; }
.field-cell b { margin-left: 4px; color: #c83f3f; font-size: 10px; }
.field-cell i { color: #86919c; font-style: normal; }
.query-condition-cell { color: #526474; line-height: 1.6; white-space: normal; }
.empty-state { padding: 24px; color: #929ca6; text-align: center; }
.history-pager { display: flex; align-items: center; justify-content: flex-end; gap: 10px; min-height: 50px; padding: 8px 18px; color: #6e7a86; font-size: 12px; }
.history-pager label { display: flex; align-items: center; gap: 5px; }
.history-pager select, .history-pager button { height: 30px; border: 1px solid #d4dce5; border-radius: 4px; background: #fff; }
.history-pager select { padding: 0 7px; }
.history-pager button { width: 32px; cursor: pointer; }
.history-pager button:disabled { cursor: not-allowed; opacity: .45; }
@media (max-width: 820px) { .history-backdrop { padding: 8px; } .history-dialog { width: 100%; height: 96vh; } .history-body { grid-template-columns: 180px minmax(0, 1fr); } .history-filters { overflow-x: auto; } .history-filters label { min-width: 145px; } }
</style>
