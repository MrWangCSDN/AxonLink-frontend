<template>
  <section class="database-issues-page" aria-label="回放数据库问题清单">
    <header class="database-toolbar">
      <div class="database-title"><button class="icon-button mobile-navigation" aria-label="打开导航" @click="$emit('toggleNavigation')"><Menu :size="18" /></button><div><h2>回放数据库问题清单</h2><p>按批次跟踪表级与字段级差异</p></div></div>
      <div class="toolbar-actions"><button class="button" data-testid="reset-filters" @click="reset">重置筛选条件</button><button class="button primary" data-testid="open-import" @click="openImport"><Upload :size="15" />导入 Excel</button><button class="button" data-testid="export-issues" :disabled="exporting" @click="exportRows"><Download :size="15" />{{ exporting ? '导出中…' : '导出 Excel' }}</button><button class="icon-button" title="刷新清单" aria-label="刷新清单" :disabled="loading" @click="refresh"><RefreshCw :size="16" /></button></div>
    </header>
    <p v-if="error" class="message error" role="alert">{{ error }}</p>
    <div class="table-viewport" :aria-busy="loading" @scroll="closeHeaderFilter">
      <table class="database-table" :style="{ '--database-table-width': tableWidth }"><colgroup><col v-for="column in columns" :key="column.key" :style="{ width: column.width }" /></colgroup><thead><tr><th v-for="column in columns" :key="column.key" scope="col"><span>{{ column.label }}</span>
        <button v-if="column.key === 'differenceCount'" type="button" class="replay-count-sort-button" :class="{ 'is-active': differenceCountOrder !== '' }" :data-sort="differenceCountOrder ? differenceCountOrder.toLowerCase() : 'default'" :title="differenceCountSortLabel" :aria-label="differenceCountSortLabel" data-testid="difference-count-sort" @click.stop="toggleDifferenceCountSort"><ArrowUpNarrowWide v-if="differenceCountOrder === 'ASC'" :size="17" aria-hidden="true" /><ArrowDownWideNarrow v-else :size="17" aria-hidden="true" /></button>
        <button v-else-if="headerFilterConfig[column.key]" class="replay-header-filter-button" :class="{ active: headerFilters[column.key]?.length }" :data-testid="`header-filter-${column.key}`" :title="`筛选${column.label}`" :aria-label="`筛选${column.label}`" :aria-expanded="headerFilterOpen && activeHeaderColumn?.key === column.key" @click.stop="openHeaderFilter(column, $event)"><i aria-hidden="true"></i></button></th></tr></thead><tbody>
        <tr v-for="row in rows" :key="row.id">
          <td v-for="column in columns" :key="column.key" :class="{ 'number-cell': column.key === 'differenceCount', 'status-cell': column.key === 'issueStatus', 'human-cell': ['issueType','cooperationPerson'].includes(column.key), 'analysis-cell': ['initialAnalysis','finalSolution','remark'].includes(column.key) }">
            <div v-if="column.key === 'operation'" class="row-actions"><button class="button compact" :data-testid="`edit-${row.id}`" :disabled="!canEdit(row)" @click="openEdit(row)"><Pencil :size="12" />编辑</button><button class="button compact" :data-testid="`tracking-${row.id}`" @click="openTracking(row)"><History :size="12" />问题跟踪</button></div>
            <div v-else-if="column.key === 'tableName'" class="table-name-cell" :title="[row.tableName, row.tableComment].filter(Boolean).join('\n')">
              <button type="button" class="cell-copy cell-text table-name-english" :data-testid="`copy-${row.id}-tableName`" aria-label="复制表英文名" :title="copyTitle('表英文名',row.tableName)" :disabled="!hasCopyValue(row.tableName)" @click.stop="copyValue(row.tableName,'表英文名')">{{ display(row.tableName) }}</button>
              <button type="button" class="cell-copy cell-text table-name-chinese" :data-testid="`copy-${row.id}-tableComment`" aria-label="复制表中文名" :title="copyTitle('表中文名',row.tableComment)" :disabled="!hasCopyValue(row.tableComment)" @click.stop="copyValue(row.tableComment,'表中文名')">{{ display(row.tableComment) }}</button>
            </div>
            <button v-else-if="column.key === 'batchNo'" type="button" class="cell-copy cell-text" :data-testid="`copy-${row.id}-batchNo`" aria-label="复制出现批次" :title="copyTitle(column.label,occurrenceBatchValue(row))" :disabled="!hasCopyValue(occurrenceBatchValue(row))" @click.stop="copyValue(occurrenceBatchValue(row),column.label)">{{ appearanceBatches(row) }}</button>
            <template v-else-if="column.key === 'reviewStatus' && hasReviewStatus(row)">
              <div class="review-status-cell">
                <button v-if="canReview(row)" type="button" class="replay-review-badge" :class="reviewStatusLabel(row) === '待审核' ? 'is-pending' : 'is-approved'" :data-testid="`review-${row.id}`" :title="reviewActionTitle(row)" @click="openReview(row)">{{ reviewStatusLabel(row) }}</button>
                <span v-else class="replay-review-badge" :class="reviewStatusLabel(row) === '待审核' ? 'is-pending' : 'is-approved'" :data-testid="`review-${row.id}`" :title="reviewActionTitle(row)">{{ reviewStatusLabel(row) }}</span>
                <button type="button" class="cell-copy-icon" :data-testid="`copy-${row.id}-reviewStatus`" aria-label="复制审核状态" :title="copyTitle(column.label,reviewStatusLabel(row))" @click.stop="copyValue(reviewStatusLabel(row),column.label)"><Copy :size="13" aria-hidden="true" /></button>
              </div>
            </template>
            <button v-else type="button" class="cell-copy cell-text" :class="{ 'is-fixed': column.key === 'issueStatus' && row.issueStatus === '已修复' }" :data-testid="`copy-${row.id}-${column.key}`" :aria-label="`复制${column.label}`" :title="copyTitle(column.label,row[column.key])" :disabled="!hasCopyValue(row[column.key])" @click.stop="copyValue(row[column.key],column.label)">{{ column.key === 'differenceCount' ? formatCount(row[column.key]) : display(row[column.key]) }}</button>
          </td>
        </tr>
        <tr v-if="!rows.length && !loading"><td :colspan="columns.length" class="empty-state">{{ error ? '加载失败，请重试' : '暂无问题，请导入 BD 的每日核对结果报表' }}</td></tr>
      </tbody></table>
    </div>
    <p v-if="copyMessage" class="copy-feedback" :class="{ 'is-error': copyFailed }" :role="copyFailed ? 'alert' : 'status'" aria-live="polite" aria-atomic="true" data-testid="copy-feedback">{{ copyMessage }}</p>
    <div v-if="headerFilterOpen" class="replay-header-filter-panel" :style="headerFilterPanelStyle" data-testid="header-filter-panel" role="dialog" :aria-label="`筛选${activeHeaderColumn?.label}`">
      <header><strong>筛选 {{ activeHeaderColumn?.label }}</strong></header>
      <div class="replay-header-filter-content">
        <div class="replay-header-filter-search"><input v-model.trim="headerFilterSearch" type="search" placeholder="模糊搜索" data-testid="header-filter-search" @keydown.enter.prevent="loadHeaderFilterOptions" /><button aria-label="查询筛选选项" @click="loadHeaderFilterOptions"><Search :size="14" /></button></div>
        <div class="replay-header-filter-actions"><button @click="selectAllHeaderOptions" :disabled="headerFilterLoading || !!headerFilterError">全选</button><button @click="invertHeaderOptions" :disabled="headerFilterLoading || !!headerFilterError">反选</button><span class="replay-header-filter-count">筛选数（{{ headerFilterCandidateCount }}）</span><span class="replay-header-filter-count">计数（{{ headerFilterMatchedIssueCount }}）</span></div>
        <div class="replay-header-filter-options" :aria-busy="headerFilterLoading"><p v-if="headerFilterLoading" role="status">正在加载…</p><p v-else-if="headerFilterError" role="alert">{{ headerFilterError }}</p><template v-else><p v-if="headerFilterValidationError" role="alert">{{ headerFilterValidationError }}</p><label v-for="option in headerFilterOptions" :key="option.value"><input v-model="headerFilterDraft" type="checkbox" :value="option.value" @change="headerFilterValidationError = ''" /><span class="replay-header-filter-option-label">{{ option.value === '' ? '（空白）' : (option.label || option.value) }}</span><span class="replay-header-filter-option-count">（{{ option.count }}）</span></label><p v-if="!headerFilterOptions.length">暂无选项</p><p v-if="headerFilterTruncated">仅显示前 500 项，请搜索缩小范围</p></template></div>
      </div>
      <footer><button class="button compact replay-header-filter-clear" data-testid="clear-header-filter" @click="clearHeaderFilter">清空筛选</button><span class="replay-header-filter-footer-spacer"></span><button class="button compact" aria-label="关闭筛选" @click="closeHeaderFilter">取消</button><button class="button primary compact" data-testid="apply-header-filter" :disabled="headerFilterLoading || !!headerFilterError" @click="applyHeaderFilter">确定</button></footer>
      <button class="replay-header-filter-resize-handle" aria-label="拖拽调整筛选窗口大小" @pointerdown="startHeaderFilterResize"></button>
    </div>
    <footer class="pagination"><span>共 {{ total }} 条，第 {{ pageNumber }} / {{ pageCount }} 页</span><label>每页 <select v-model.number="limit" @change="queryRows"><option :value="50">50</option><option :value="100">100</option><option :value="200">200</option></select> 条</label><button class="icon-button" aria-label="上一页" title="上一页" :disabled="offset === 0 || loading" @click="changePage(-1)"><ChevronLeft :size="16" /></button><button class="icon-button" aria-label="下一页" title="下一页" :disabled="offset + limit >= total || loading" @click="changePage(1)"><ChevronRight :size="16" /></button></footer>

    <div v-if="importOpen" class="modal-mask" @click.self="closeImport"><section class="dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="database-import-title"><header><div><h3 id="database-import-title">导入数据库问题</h3><p>导入 BD 每日核对结果报表</p></div><button class="icon-button" :disabled="importing" aria-label="关闭导入" @click="closeImport"><X :size="17" /></button></header>
      <p>选择 BD 导出报表，需包含“表明细”和“表字段明细”。仅导入差异笔数大于 0 的问题。</p><p>领域、开发负责人、科技负责人按表英文名关联数据库表人员清单。Excel 中的领域和负责人列可省略。</p><label><span>Excel 文件</span><input type="file" accept=".xlsx,.xls" data-testid="import-file" :disabled="importing" @change="selectFile" /><small v-if="importFile">{{ importFile.name }}</small></label>
      <label>批次号<input v-model="importBatch" placeholder="DB20261012-01" data-testid="import-batch" :disabled="importing" /><small>新报表自动读取批次号；旧报表请补填。填写值须与文件批次一致。</small></label>
      <label><span>发版时间 <span aria-hidden="true">*</span></span><input v-model="importReleaseAt" type="datetime-local" step="1" required data-testid="import-release-at" :disabled="importing" @input="importReleaseEdited = true" /><small>{{ importReading ? '正在识别批次日期…' : '默认批次日期前一天中午12:00:00，可手动修改；晚于发版时间保存的修复待验证问题，本次不重新打开。' }}</small></label>
      <p class="import-note">导入会保留协同人、问题类型、分析、方案和备注；本次成功核对的表中消失的问题将自动标为已修复。</p>
      <p v-if="importError" class="message error" role="alert">{{ importError }}</p><p v-if="importResult" class="message success" role="status">{{ importResult.batchNo }}：新增 {{ importResult.createdRows }}，更新 {{ importResult.updatedRows }}，自动修复 {{ importResult.autoRepairedRows }}。</p>
      <footer><button class="button" :disabled="importing" @click="closeImport">关闭</button><button class="button primary" :disabled="!importFile || importing || importReading || !normalizeReleaseAt(importReleaseAt)" data-testid="submit-import" @click="submitImport"><Upload :size="15" />{{ importing ? '导入中…' : '开始导入' }}</button></footer>
    </section></div>

    <div v-if="editRow" class="modal-mask" @click.self="closeEdit"><section class="dialog edit-dialog" role="dialog" aria-modal="true" aria-labelledby="database-edit-title" data-testid="edit-modal"><header><div><h3 id="database-edit-title">编辑数据库问题</h3><p>{{ editRow.issueId }} · {{ editRow.batchNo }}</p></div><button class="icon-button" :disabled="saving" aria-label="关闭编辑" @click="closeEdit"><X :size="17" /></button></header>
      <div class="edit-fields"><label><span>问题状态</span><select v-model="draft.issueStatus" data-testid="edit-status" @change="statusChanged"><option v-if="!manualStatuses.includes(draft.issueStatus)" :value="draft.issueStatus">当前：{{ draft.issueStatus }}</option><option v-for="value in editableStatuses" :key="value">{{ value }}</option></select></label>
      <label><span class="field-label">问题类型 <em class="required-mark">*</em></span><select v-model="draft.issueType" :disabled="draft.issueStatus === '延后修复'" data-testid="edit-type"><option value="">请选择问题类型</option><option v-for="value in editableTypes" :key="value">{{ value }}</option></select></label>
      <label class="wide"><span>初步问题分析 <small>{{ draft.initialAnalysis.length }}/500</small></span><textarea v-model="draft.initialAnalysis" maxlength="500" rows="4" data-testid="edit-analysis" /></label>
      <label class="wide"><span>最终处理方案 <small>{{ draft.finalSolution.length }}/500</small></span><textarea v-model="draft.finalSolution" maxlength="500" rows="4" data-testid="edit-solution" /></label>
      <label class="wide"><span>备注 <small>{{ draft.remark.length }}/500</small></span><textarea v-model="draft.remark" maxlength="500" rows="3" data-testid="edit-remark" /></label>
      <label class="wide collaborator-field"><span>需协同人</span><div class="user-picker"><input v-model="collaboratorText" type="search" placeholder="姓名或账号" data-testid="edit-collaborator" autocomplete="off" @input="searchCollaborator" /><ul v-if="collaborators.length" class="user-options"><li v-for="user in collaborators" :key="user.username"><button @click="selectCollaborator(user)">{{ user.realName || user.displayName || user.username }} ({{ user.username }})</button></li></ul></div><small v-if="collaboratorLoading">正在搜索…</small></label></div>
      <p v-if="editError" class="form-error" role="alert">{{ editError }}</p><footer><button class="button" :disabled="saving" @click="closeEdit">取消</button><button class="button primary" :disabled="saving" data-testid="save-edit" @click="saveEdit"><Save :size="14" />{{ saving ? '保存中…' : '保存' }}</button></footer>
    </section></div>

    <div v-if="reviewRow" class="modal-mask" @click.self="closeReview"><section class="dialog review-dialog" role="dialog" aria-modal="true" aria-labelledby="database-review-title" data-testid="review-modal"><header><div><h3 id="database-review-title">{{ reviewModalTitle }}</h3><p>issue_id：{{ reviewRow.issueId }}</p></div><button class="icon-button" :disabled="reviewing" aria-label="关闭审核窗口" @click="closeReview"><X :size="17" /></button></header><label class="review-reason-field"><span class="field-label">审核原因 <em class="required-mark">*</em><small>{{ reviewReason.length }}/500</small></span><textarea v-model="reviewReason" maxlength="500" rows="5" placeholder="请填写审核原因" data-testid="review-reason" @input="reviewError = ''" /></label><p v-if="reviewError" class="form-error" role="alert" data-testid="review-error">{{ reviewError }}</p><footer><button class="button" :disabled="reviewing" @click="closeReview">取消</button><button class="button primary" :disabled="reviewing" data-testid="submit-review" @click="submitReview"><Save :size="15" />{{ reviewing ? '保存中…' : '确认' }}</button></footer></section></div>

    <div v-if="trackingOpen" class="drawer-mask" @click.self="closeTracking"><aside class="tracking-drawer" role="dialog" aria-modal="true" aria-labelledby="database-tracking-title" data-testid="tracking-drawer"><header><div><h3 id="database-tracking-title">问题跟踪路径</h3><p>{{ trackingRow?.issueId }}</p></div><button class="icon-button" aria-label="关闭问题跟踪" @click="closeTracking"><X :size="17" /></button></header><p v-if="trackingLoading" role="status">正在加载…</p><p v-else-if="trackingError" class="message error">{{ trackingError }}</p>
      <ol v-else class="batch-timeline"><li v-for="(group, index) in trackingGroups" :key="group.batchNo"><details open class="batch-group"><summary><strong>批次编号 {{ group.batchNo }}</strong><span v-if="index === 0" class="latest-batch">最新批次</span></summary><div class="batch-body"><button class="text-button" data-testid="original-data-toggle" @click="sourceExpanded[group.batchNo] = !sourceExpanded[group.batchNo]"><ChevronDown :size="13" />原始数据</button><dl v-if="sourceExpanded[group.batchNo]" class="original-data"><template v-for="(value, key) in group.originalData" :key="key"><dt>{{ sourceLabels[key] || key }}</dt><dd><ReplayTrackingValue :value="value" /></dd></template><span v-if="!Object.keys(group.originalData || {}).length">无</span></dl><p class="section-title">变更时间线</p><article v-for="event in group.events" :key="event.id" class="tracking-event"><div class="event-heading"><strong>{{ event.operationType }}</strong><time>{{ event.operationAt }}</time></div><p class="operator">操作人 {{ event.operatorName || event.operatorUsername }}<template v-if="event.operatorName && event.operatorUsername"> ({{ event.operatorUsername }})</template></p><div v-if="event.changes?.length" class="changes-table" role="table"><div class="change-header" role="row"><span>字段</span><span>变更前</span><span>变更后</span></div><div v-for="change in event.changes" :key="change.field" role="row"><span>{{ change.field }}</span><ReplayTrackingValue :value="change.before" /><ReplayTrackingValue :value="change.after" /></div></div><p v-else class="no-changes">人工字段无变化，基础数据按本批次更新。</p></article></div></details></li><li v-if="!trackingGroups.length" class="empty-state">暂无跟踪记录</li></ol>
    </aside></div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, History, Menu, Pencil, RefreshCw, Save, Search, Upload, X } from 'lucide-vue-next'
import ReplayTrackingValue from './ReplayTrackingValue.vue'
import { listDatabaseIssues, getDatabaseIssueOptions, getDatabaseIssueFilterOptions, importDatabaseIssues, updateDatabaseIssue, getDatabaseIssueTracking, approveDatabaseIssue, exportDatabaseIssues } from '../../api/replayDatabaseIssues.js'
import { searchReplayIssueUsers } from '../../api/replayIssues.js'
import { copyText } from '../../utils/clipboard.js'
import { defaultReleaseAt, normalizeReleaseAt, readImportBatch } from '../../utils/replayReleaseTime.js'
defineEmits(['toggleNavigation'])
const columns = [
  ['tableName','表英文名/中文名','180px'],['domain','领域','90px'],['owner','开发负责人','180px'],['technologyOwnerDisplay','科技负责人','180px'],['issueLevel','问题级别','90px'],['fieldName','字段英文名','117px'],['differenceCount','差异笔数','100px'],['defectRepairDate','缺陷修复日期','125px'],['issueId','issue_id','230px'],['operation','操作','176px'],['issueStatus','问题状态','99px'],['reviewStatus','审核状态','160px'],['issueType','问题类型','99px'],['cooperationPerson','需协同人','135px'],['initialAnalysis','初步问题分析','240px'],['finalSolution','最终处理方案','260px'],['remark','备注','210px'],['batchNo','出现批次','220px'],
].map(([key,label,width]) => ({key,label,width}))
const tableWidth = `${columns.reduce((sum, column) => sum + parseInt(column.width, 10), 0)}px`
const sourceLabels = {...Object.fromEntries(columns.map(c => [c.key,c.label])),tableName:'表英文名',tableComment:'表中文名',firstOccurredDate:'首次出现日期',lastOccurredDate:'最近出现日期',reviewStatus:'审核状态',reviewReason:'审核原因',reviewerUsername:'审核人账号',reviewerName:'审核人'}
const headerFilterConfig = { issueId:'issueIds', tableName:'tableNames', domain:'domains', owner:'owners', cooperationPerson:'cooperationPersons', issueLevel:'issueLevels', fieldName:'fieldNames', defectRepairDate:'defectRepairDates', batchNo:'batchNos', issueStatus:'issueStatuses', reviewStatus:'reviewStatuses', issueType:'issueTypes' }
const headerFilters = reactive({})
function filterParams(excludeKey) {
  return Object.fromEntries(Object.entries(headerFilterConfig).filter(([key]) => key !== excludeKey && headerFilters[key]?.length).map(([key, param]) => [param, [...headerFilters[key]]]))
}
const differenceCountOrder = ref('')
const differenceCountSortLabel = computed(() => differenceCountOrder.value === 'ASC'
  ? '当前差异笔数升序，点击切换为降序'
  : differenceCountOrder.value === 'DESC' ? '当前差异笔数降序，点击恢复默认排序' : '按差异笔数升序排序')
const orderedCriteria = () => ({...filterParams(),...(differenceCountOrder.value ? {differenceCountOrder:differenceCountOrder.value} : {})})
const options = reactive({domains:[],owners:[],batches:[],issueLevels:['仅ccbs','仅528','字段级'],issueTypes:[],issueStatuses:[]})
const rows=ref([]), total=ref(0),offset=ref(0),limit=ref(50),loading=ref(false),error=ref(''),exporting=ref(false)
const pageNumber=computed(()=>Math.floor(offset.value/limit.value)+1),pageCount=computed(()=>Math.max(1,Math.ceil(total.value/limit.value)))
let alive=true,listSequence=0,trackingSequence=0,collaboratorSequence=0,collaboratorTimer
const display=value=>value===undefined||value===null||value===''?'-':String(value)
const occurrenceBatchValue=row=>row.occurrenceBatches?.length ? row.occurrenceBatches.join('、') : row.batchNo
const appearanceBatches=row=>display(occurrenceBatchValue(row))
const formatCount=value=>typeof value==='number'?value.toLocaleString('zh-CN'):display(value)
const copyMessage=ref(''),copyFailed=ref(false)
let copyTimer=null,copySequence=0
const hasCopyValue=value=>value!==null&&value!==undefined&&String(value).trim()!==''
const copyTitle=(label,value)=>hasCopyValue(value)?`点击复制${label}：${String(value)}`:'暂无内容可复制'
async function copyValue(value,label){
  if(!hasCopyValue(value))return
  const sequence=++copySequence
  let copied=false
  try{copied=await copyText(String(value))}catch{copied=false}
  if(!alive||sequence!==copySequence)return
  copyFailed.value=!copied
  copyMessage.value=copied?`已复制：${label}`:'复制失败，请手动选择文字复制'
  clearTimeout(copyTimer)
  copyTimer=setTimeout(()=>{copyMessage.value='';copyTimer=null},1600)
}
const params=()=>({...orderedCriteria(),offset:offset.value,limit:limit.value})
async function loadRows(){const sequence=++listSequence;loading.value=true;error.value='';try{const result=await listDatabaseIssues(params());if(!alive||sequence!==listSequence)return;rows.value=result.items||[];total.value=result.total||0;if(offset.value>=total.value&&offset.value>0){offset.value=Math.max(0,(Math.ceil(total.value/limit.value)-1)*limit.value);await loadRows()}}catch(e){if(alive&&sequence===listSequence){rows.value=[];total.value=0;error.value=e.message||'加载失败'}}finally{if(alive&&sequence===listSequence)loading.value=false}}
async function loadOptions(){try{const result=await getDatabaseIssueOptions();if(alive)Object.assign(options,result)}catch(e){if(alive)error.value=e.message||'筛选选项加载失败'}}
async function refresh(){await Promise.all([loadRows(),loadOptions()])}
function queryRows(){offset.value=0;return loadRows()}
function reset(){for(const key in headerFilters)delete headerFilters[key];differenceCountOrder.value='';closeHeaderFilter();return queryRows()}
function toggleDifferenceCountSort(){differenceCountOrder.value=differenceCountOrder.value===''?'ASC':differenceCountOrder.value==='ASC'?'DESC':'';closeHeaderFilter();return queryRows()}
function changePage(direction){offset.value=Math.max(0,offset.value+direction*limit.value);return loadRows()}
async function exportRows(){exporting.value=true;error.value='';try{await exportDatabaseIssues(orderedCriteria())}catch(e){error.value=e.message||'导出失败'}finally{exporting.value=false}}
const headerFilterOpen = ref(false), activeHeaderColumn = ref(null), headerFilterSearch = ref('')
const headerFilterOptions = ref([]), headerFilterDraft = ref([]), headerFilterLoading = ref(false), headerFilterError = ref('')
const headerFilterValidationError = ref('')
const headerFilterCandidateCount = ref(0), headerFilterMatchedIssueCount = ref(0), headerFilterTruncated = ref(false)
const headerFilterSize = reactive({width:380,height:360})
const headerFilterPanelStyle = reactive({left:'12px',top:'96px',width:'380px',height:'360px'})
let headerFilterAnchor = null, headerFilterResizeState = null, headerFilterSequence = 0
async function openHeaderFilter(column, event) {
  activeHeaderColumn.value = column
  headerFilterSearch.value = ''
  headerFilterValidationError.value = ''
  headerFilterDraft.value = [...(headerFilters[column.key] || [])]
  headerFilterAnchor = event.currentTarget
  headerFilterOpen.value = true
  positionHeaderFilter()
  await loadHeaderFilterOptions()
}
async function loadHeaderFilterOptions() {
  if (!headerFilterOpen.value || !activeHeaderColumn.value) return
  const sequence = ++headerFilterSequence
  const field = activeHeaderColumn.value.key
  headerFilterLoading.value = true
  headerFilterError.value = ''
  headerFilterOptions.value = []
  headerFilterCandidateCount.value = 0
  headerFilterMatchedIssueCount.value = 0
  headerFilterTruncated.value = false
  try {
    const result = await getDatabaseIssueFilterOptions({...filterParams(field),field,...(headerFilterSearch.value ? {keyword:headerFilterSearch.value} : {})})
    if (!alive || sequence !== headerFilterSequence) return
    headerFilterOptions.value = result.items || []
    headerFilterCandidateCount.value = Number(result.candidateCount) || 0
    headerFilterMatchedIssueCount.value = Number(result.matchedIssueCount) || 0
    headerFilterTruncated.value = Boolean(result.truncated)
  } catch (e) {
    if (alive && sequence === headerFilterSequence) headerFilterError.value = e.message || '筛选选项加载失败，请重试'
  } finally {
    if (alive && sequence === headerFilterSequence) headerFilterLoading.value = false
  }
}
function selectAllHeaderOptions() {
  headerFilterDraft.value = [...new Set([...headerFilterDraft.value,...headerFilterOptions.value.map(option => option.value)])]
}
function invertHeaderOptions() {
  const visible = new Set(headerFilterOptions.value.map(option => option.value))
  const selected = new Set(headerFilterDraft.value)
  headerFilterDraft.value = [...headerFilterDraft.value.filter(value => !visible.has(value)),...headerFilterOptions.value.filter(option => !selected.has(option.value)).map(option => option.value)]
}
function applyHeaderFilter() {
  if (headerFilterLoading.value || headerFilterError.value) return
  if (headerFilterDraft.value.length > 500) {
    headerFilterValidationError.value = '每列最多选择 500 项，请取消部分勾选后再确定'
    return
  }
  headerFilters[activeHeaderColumn.value.key] = [...headerFilterDraft.value]
  closeHeaderFilter()
  return queryRows()
}
function clearHeaderFilter() {
  delete headerFilters[activeHeaderColumn.value.key]
  closeHeaderFilter()
  return queryRows()
}
function closeHeaderFilter() {
  headerFilterOpen.value = false
  headerFilterSequence++
  headerFilterAnchor = null
  stopHeaderFilterResize()
}
function onFilterOutside(event) {
  if (headerFilterOpen.value && !event.target?.closest?.('.replay-header-filter-panel, .replay-header-filter-button')) closeHeaderFilter()
}
function positionHeaderFilter() {
  if (!headerFilterOpen.value) return
  const rect = headerFilterAnchor?.getBoundingClientRect?.()
  if (!rect) return
  headerFilterSize.width = Math.min(headerFilterSize.width,Math.max(1,window.innerWidth-24))
  headerFilterSize.height = Math.min(headerFilterSize.height,Math.max(1,window.innerHeight-24))
  const left = Math.max(12,Math.min(rect.left,window.innerWidth-headerFilterSize.width-12))
  const below = rect.bottom+8
  const top = below+headerFilterSize.height <= window.innerHeight-12 ? below : Math.max(12,rect.top-headerFilterSize.height-8)
  Object.assign(headerFilterPanelStyle,{left:`${left}px`,top:`${top}px`})
  syncHeaderFilterSizeStyle()
}
function syncHeaderFilterSizeStyle() {
  headerFilterPanelStyle.width = `${Math.round(headerFilterSize.width)}px`
  headerFilterPanelStyle.height = `${Math.round(headerFilterSize.height)}px`
}
function startHeaderFilterResize(event) {
  event.preventDefault()
  headerFilterResizeState = {startX:event.clientX,startY:event.clientY,startWidth:headerFilterSize.width,startHeight:headerFilterSize.height}
  event.currentTarget?.setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove',resizeHeaderFilter)
  window.addEventListener('pointerup',stopHeaderFilterResize)
  window.addEventListener('pointercancel',stopHeaderFilterResize)
}
function resizeHeaderFilter(event) {
  if (!headerFilterResizeState) return
  const maxWidth = Math.max(1,window.innerWidth-Number.parseFloat(headerFilterPanelStyle.left)-12)
  const maxHeight = Math.max(1,window.innerHeight-Number.parseFloat(headerFilterPanelStyle.top)-12)
  headerFilterSize.width = Math.max(Math.min(280,maxWidth),Math.min(headerFilterResizeState.startWidth+event.clientX-headerFilterResizeState.startX,maxWidth))
  headerFilterSize.height = Math.max(Math.min(260,maxHeight),Math.min(headerFilterResizeState.startHeight+event.clientY-headerFilterResizeState.startY,maxHeight))
  syncHeaderFilterSizeStyle()
}
function stopHeaderFilterResize() {
  headerFilterResizeState = null
  window.removeEventListener('pointermove',resizeHeaderFilter)
  window.removeEventListener('pointerup',stopHeaderFilterResize)
  window.removeEventListener('pointercancel',stopHeaderFilterResize)
}
const canReview=row=>row.canReview === true
const canEdit=row=>row.canEdit === true
function reviewStatusLabel(row){if(row.reviewStatusDisplay)return row.reviewStatusDisplay;if(row.reviewStatus==='已审核')return row.reviewReason?.trim()?'已审核（已填写原因）':'已审核（未填写原因）';return display(row.reviewStatus)}
const hasReviewStatus=row=>row.issueStatus==='无需处理'&&['待审核','已审核（未填写原因）','已审核（已填写原因）'].includes(reviewStatusLabel(row))
function reviewActionTitle(row){if(canReview(row))return reviewStatusLabel(row)==='待审核'?'点击审核':'点击填写或更新审核原因';const owner=row.technologyOwnerDisplay||row.technologyOwnerName;return owner?`没有权限，请联系科技负责人${owner}进行审核`:'未配置科技负责人，请先在数据库表人员清单中配置'}
const importOpen=ref(false),importing=ref(false),importFile=ref(null),importBatch=ref(''),importError=ref(''),importResult=ref(null)
const importReleaseAt=ref(''),importReleaseEdited=ref(false),importReading=ref(false)
let importReadVersion=0
watch(importBatch,batch=>{if(!importReleaseEdited.value)importReleaseAt.value=defaultReleaseAt(batch)})
function openImport(){importReadVersion++;importReading.value=false;importFile.value=null;importBatch.value='';importReleaseAt.value='';importReleaseEdited.value=false;importError.value='';importResult.value=null;importOpen.value=true}
function closeImport(){if(!importing.value){importReadVersion++;importOpen.value=false}}
async function selectFile(event){
  const version=++importReadVersion
  importFile.value=event.target.files?.[0]||null;importResult.value=null;importError.value='';importBatch.value='';importReleaseAt.value='';importReleaseEdited.value=false
  importReading.value=true
  try{const batch=await readImportBatch(importFile.value,'DB');if(version===importReadVersion&&importOpen.value&&!importBatch.value)importBatch.value=batch}
  finally{if(version===importReadVersion)importReading.value=false}
}
async function submitImport(){if(!importFile.value||importing.value||importReading.value)return;const releaseAt=normalizeReleaseAt(importReleaseAt.value);if(!releaseAt){importError.value='请填写完整的发版时间（年月日时分秒）';return}importing.value=true;importError.value='';importResult.value=null;try{importResult.value=await importDatabaseIssues(importFile.value,importBatch.value,releaseAt);offset.value=0;await refresh()}catch(e){importError.value=e.message||'导入失败'}finally{importing.value=false}}
const editRow=ref(null),saving=ref(false),editError=ref(''),draft=reactive({version:0,issueStatus:'',issueType:'',cooperationPersonUsername:'',initialAnalysis:'',finalSolution:'',remark:''})
const manualStatuses=['打开','无需处理','延后修复','修复待验证'],noActionTypes=['合理差异','规则性差异问题','外围问题']
const editableStatuses=computed(()=>editRow.value?.issueStatus==='重新打开'?manualStatuses.filter(s=>s!=='打开'):manualStatuses)
const editableTypes=computed(()=>draft.issueStatus==='无需处理'?noActionTypes:draft.issueStatus==='延后修复'?['迁移问题']:options.issueTypes)
const collaboratorText=ref(''),selectedCollaboratorText=ref(''),collaborators=ref([]),collaboratorLoading=ref(false)
function openEdit(row){editRow.value=row;for(const key of Object.keys(draft))draft[key]=row[key]??(key==='version'?0:'');collaboratorText.value=row.cooperationPerson||'';selectedCollaboratorText.value=collaboratorText.value;collaborators.value=[];editError.value=''}
function closeEdit(){if(saving.value)return;editRow.value=null;collaboratorSequence++;clearTimeout(collaboratorTimer);collaborators.value=[];collaboratorLoading.value=false}
function statusChanged(){if(draft.issueStatus==='无需处理')draft.issueType='合理差异';if(draft.issueStatus==='延后修复')draft.issueType='迁移问题'}
function searchCollaborator(){const sequence=++collaboratorSequence;clearTimeout(collaboratorTimer);draft.cooperationPersonUsername='';selectedCollaboratorText.value='';collaborators.value=[];collaboratorLoading.value=false;const keyword=collaboratorText.value.trim();if(!keyword)return;collaboratorLoading.value=true;collaboratorTimer=setTimeout(async()=>{try{const result=await searchReplayIssueUsers(keyword,20);if(alive&&editRow.value&&sequence===collaboratorSequence)collaborators.value=result||[]}catch(e){if(sequence===collaboratorSequence)editError.value=e.message||'搜索失败'}finally{if(sequence===collaboratorSequence)collaboratorLoading.value=false}},250)}
function selectCollaborator(user){collaboratorSequence++;draft.cooperationPersonUsername=user.username;collaboratorText.value=`${user.realName||user.displayName||user.username}(${user.username})`;selectedCollaboratorText.value=collaboratorText.value;collaborators.value=[];collaboratorLoading.value=false}
async function saveEdit(){if(saving.value||!editRow.value)return;editError.value='';if(!draft.issueType){editError.value='请选择问题类型';return}if(collaboratorText.value.trim()&&(!draft.cooperationPersonUsername||collaboratorText.value!==selectedCollaboratorText.value)){editError.value='请从搜索结果中选择需协同人';return}saving.value=true;try{await updateDatabaseIssue(editRow.value.id,{...draft});editRow.value=null;await loadRows()}catch(e){editError.value=e.message||'保存失败'}finally{saving.value=false}}
const reviewRow=ref(null),reviewReason=ref(''),reviewError=ref(''),reviewing=ref(false)
const reviewModalTitle=computed(()=>reviewStatusLabel(reviewRow.value||{})==='待审核'?'审核无需处理问题':reviewRow.value?.reviewReason?.trim()?'更新审核原因':'补充审核原因')
function openReview(row){if(!canReview(row)||!hasReviewStatus(row))return;reviewRow.value=row;reviewReason.value=row.reviewReason||'';reviewError.value=''}
function closeReview(){if(reviewing.value)return;reviewRow.value=null;reviewReason.value='';reviewError.value=''}
async function submitReview(){if(reviewing.value||!reviewRow.value)return;const reason=reviewReason.value.trim();if(!reason){reviewError.value='请填写审核原因';return}reviewing.value=true;reviewError.value='';try{await approveDatabaseIssue(reviewRow.value.id,{version:reviewRow.value.version,reason});reviewRow.value=null;reviewReason.value='';await loadRows()}catch(e){reviewError.value=e.message||'审核失败'}finally{reviewing.value=false}}
const trackingOpen=ref(false),trackingRow=ref(null),trackingLoading=ref(false),trackingError=ref(''),trackingGroups=ref([]),sourceExpanded=reactive({})
async function openTracking(row){const sequence=++trackingSequence;trackingRow.value=row;trackingOpen.value=true;trackingLoading.value=true;trackingError.value='';trackingGroups.value=[];for(const key in sourceExpanded)delete sourceExpanded[key];try{const result=await getDatabaseIssueTracking(row.id);if(alive&&sequence===trackingSequence&&trackingOpen.value)trackingGroups.value=result||[]}catch(e){if(sequence===trackingSequence)trackingError.value=e.message||'跟踪加载失败'}finally{if(sequence===trackingSequence)trackingLoading.value=false}}
function closeTracking(){trackingOpen.value=false;trackingSequence++}
function onEscape(event){if(event.key!=='Escape')return;if(headerFilterOpen.value)closeHeaderFilter();else if(editRow.value)closeEdit();else if(reviewRow.value)closeReview();else if(importOpen.value)closeImport();else closeTracking()}
onMounted(()=>{refresh();window.addEventListener('keydown',onEscape);window.addEventListener('resize',positionHeaderFilter);document.addEventListener('pointerdown',onFilterOutside)})
onBeforeUnmount(()=>{alive=false;collaboratorSequence++;copySequence++;clearTimeout(copyTimer);clearTimeout(collaboratorTimer);closeHeaderFilter();window.removeEventListener('keydown',onEscape);window.removeEventListener('resize',positionHeaderFilter);document.removeEventListener('pointerdown',onFilterOutside)})
</script>

<style scoped>
.database-issues-page{--database-teal:#0f6b78;--database-row-alt:#eef7fb;--database-content-gutter:20px;display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;overflow:hidden;color:var(--text-primary,#1f2937);background:var(--bg-page,#f7f9fc);font-size:12px}
.database-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px 12px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border,#e8edf5)}
.database-title{display:flex;align-items:center;gap:10px}h2,h3,p{margin:0}h2{font-size:19px;font-weight:650}h3{font-size:16px}.database-title p,.dialog header p,.tracking-drawer header p{margin-top:5px;color:var(--text-muted,#6b7280);font-size:12px;overflow-wrap:anywhere}
.toolbar-actions,.row-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.button,.icon-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:0 11px;border:1px solid var(--border,#dbe2eb);border-radius:4px;background:var(--bg-action-btn,#fff);color:var(--text-secondary,#374151);font:inherit;cursor:pointer;white-space:nowrap}.button.primary{background:var(--text-active,#3b5adb);border-color:var(--text-active,#3b5adb);color:var(--btn-primary-text,#fff)}.icon-button{width:32px;padding:0}.button:disabled,.icon-button:disabled{opacity:.48;cursor:not-allowed}.button.compact{min-height:27px;padding:0 7px;font-size:11px}.button:hover:not(:disabled){border-color:#8796ad}.mobile-navigation{display:none}
label{display:grid;gap:6px;color:var(--text-secondary,#374151);min-width:0}input,select,textarea{box-sizing:border-box;border:1px solid var(--border,#d9e1ea);border-radius:4px;background:var(--bg-input,#fff);padding:7px 9px;color:var(--text-primary,#1f2937);font:inherit;min-width:0;width:100%}input,select{min-height:32px}input:focus,select:focus,textarea:focus{outline:2px solid #bdd0f5;outline-offset:1px}
.table-viewport{position:relative;flex:1 1 auto;min-height:0;height:0;min-width:0;overflow:auto;overscroll-behavior:contain;padding:0 var(--database-content-gutter);scrollbar-gutter:stable}
.database-table{width:var(--database-table-width);min-width:var(--database-table-width);table-layout:fixed;border-collapse:separate;border-spacing:0;font-size:12px;margin:0}
.database-table th,.database-table td{height:34px;padding:7px 10px;vertical-align:middle;border-right:1px solid var(--border,#e8edf5);border-bottom:1px solid var(--border,#e8edf5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.database-table th{position:sticky;top:0;z-index:3;background:var(--database-teal);background-clip:padding-box;color:#fff;text-align:left;font-weight:600}
.database-table th>span{vertical-align:middle}.database-table th:first-child,.database-table td:first-child{border-left:1px solid var(--border,#e8edf5)}
.database-table td{background:var(--bg-card,#fff);line-height:normal}.database-table tr:nth-child(even) td{background:var(--database-row-alt)}.database-table tbody tr:hover td{background:var(--bg-table-hover,#edf4f8)}
.cell-text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.table-name-cell{display:grid;gap:4px;min-width:0}.table-name-chinese{color:var(--text-muted,#6b7280)}.number-cell{text-align:right;font-variant-numeric:tabular-nums}.status-cell,.human-cell{color:#cf1124}.analysis-cell{color:#2563b8}.human-cell .cell-text,.analysis-cell .cell-text{white-space:pre-wrap;overflow-wrap:anywhere}.is-fixed{color:#14804a}.row-actions{flex-wrap:nowrap;gap:5px}.empty-state{padding:40px!important;text-align:center;color:var(--text-muted,#6b7280)}
.cell-copy{box-sizing:border-box;width:100%;min-width:0;margin:0;padding:0;border:0;border-radius:2px;background:transparent;color:inherit;font:inherit;line-height:inherit;text-align:inherit;cursor:copy}.cell-copy.table-name-chinese{color:var(--text-muted,#6b7280)}.cell-copy.is-fixed{color:#14804a}.cell-copy:hover:not(:disabled){text-decoration:underline;text-underline-offset:2px}.cell-copy:focus-visible,.cell-copy-icon:focus-visible{outline:2px solid var(--text-active,#3b5adb);outline-offset:2px}.cell-copy:disabled{cursor:default;opacity:1}
.review-status-cell{display:flex;align-items:center;gap:4px;min-width:0}.review-status-cell>.replay-review-badge{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;display:block}.cell-copy-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 20px;width:20px;height:24px;padding:0;border:0;border-radius:3px;background:transparent;color:var(--text-muted,#6b7280);cursor:copy}.cell-copy-icon:hover{color:var(--text-active,#3b5adb);background:var(--bg-table-hover,#edf4f8)}
.copy-feedback{position:fixed;z-index:1600;bottom:68px;left:50%;transform:translateX(-50%);box-sizing:border-box;max-width:calc(100vw - 24px);padding:9px 14px;border:1px solid #86d3a0;border-radius:5px;background:#e8f8ed;color:#166534;font-size:12px;line-height:1.5;box-shadow:0 4px 14px rgba(13,20,36,.14);pointer-events:none}.copy-feedback.is-error{border-color:#f1b5b5;background:#fff1f1;color:#b42318}
.replay-review-badge{display:inline-flex;align-items:center;justify-content:center;min-width:58px;padding:3px 8px;border:1px solid transparent;border-radius:999px;font:inherit;font-size:12px;font-weight:650;white-space:nowrap}button.replay-review-badge{cursor:pointer}.replay-review-badge.is-pending{color:#8a4b08;border-color:#f0bd67;background:#fff4d6}.replay-review-badge.is-pending:hover{border-color:#d68a1f;background:#ffe7ad}.replay-review-badge.is-approved{color:#166534;border-color:#86d3a0;background:#e8f8ed}
.pagination{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:14px;min-height:52px;padding:10px 20px;background:var(--bg-card,#fff);border-top:1px solid var(--border,#e8edf5);color:var(--text-muted,#6b7280)}.pagination label{display:flex;align-items:center;gap:6px}.pagination select{width:66px;min-height:30px;height:30px;padding:0 7px}

.message{margin:10px 20px;padding:9px 11px;border:1px solid var(--border,#e8edf5);border-radius:4px;background:var(--bg-card,#fff);line-height:1.5;overflow-wrap:anywhere}.message.error{color:#b42318}.message.success{color:#15803d}
.modal-mask,.drawer-mask{position:fixed;inset:0;z-index:1100;background:rgba(13,20,36,.42);display:flex;align-items:center;justify-content:center;padding:20px}
.dialog{box-sizing:border-box;width:min(680px,100%);max-height:calc(100dvh - 40px);overflow:auto;padding:20px;color:var(--text-primary,#1f2937);background:var(--bg-card,#fff);border:1px solid var(--border,#e8edf5);border-radius:6px;box-shadow:0 16px 42px rgba(13,20,36,.24);display:grid;gap:16px}
.dialog header,.dialog footer,.tracking-drawer>header{display:flex;align-items:center;justify-content:space-between;gap:12px}.dialog footer{justify-content:flex-end;position:sticky;bottom:-20px;padding:12px 0 0;background:var(--bg-card,#fff)}.dialog p{color:var(--text-secondary,#4b5563);line-height:1.6}.dialog .message{margin:0}.dialog .message.error{color:#b42318}.dialog .message.success{color:#15803d}.dialog small{color:var(--text-muted,#6b7280);font-size:12px;line-height:1.45;font-variant-numeric:tabular-nums}
.import-dialog{width:min(460px,100%)}.import-note{padding:10px;background:var(--bg-page,#f5f7fa);border:1px solid var(--border,#e8edf5);border-radius:4px}
.review-dialog{width:min(520px,100%)}.review-reason-field{gap:6px}.review-reason-field textarea{min-height:112px;padding:8px 9px;border-color:var(--border,#e8edf5)}
.edit-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px 14px}.edit-fields .wide{grid-column:1/-1}.edit-fields label{gap:5px;font-size:12px;line-height:16px}.edit-fields label>span{display:flex;justify-content:space-between;gap:8px}.edit-fields input,.edit-fields select,.edit-fields textarea{border-color:var(--border,#e8edf5)}.edit-fields textarea{min-height:78px;line-height:18px}
.field-label{display:flex!important;align-items:center;justify-content:flex-start!important;gap:4px!important}.field-label>small{margin-left:auto}em{font-style:normal;color:var(--text-muted,#6b7280)}.required-mark{color:#b42318}.dialog .form-error{margin:0;color:var(--c-error-code-text,#cf1124);font-size:12px;overflow-wrap:anywhere}textarea{resize:vertical;line-height:1.5}
.user-picker{position:relative}.user-options{position:absolute;z-index:8;bottom:calc(100% + 2px);left:0;right:0;list-style:none;margin:0;padding:0;display:grid;max-height:180px;overflow:auto;border:1px solid var(--border,#e8edf5);background:var(--bg-card,#fff);box-shadow:0 8px 18px rgba(13,20,36,.16)}.user-options button{width:100%;text-align:left;border:0;background:transparent;padding:7px 8px;color:var(--text-primary,#1f2937);cursor:pointer;font:inherit}.user-options button:hover{background:var(--database-row-alt)}
.drawer-mask{padding:0;justify-content:flex-end}
.tracking-drawer{width:min(780px,94vw);height:100%;overflow:auto;background:var(--bg-card,#fff);padding:20px;box-sizing:border-box}.tracking-drawer>header{position:sticky;top:-20px;background:var(--bg-card,#fff);z-index:3;padding:16px 0;border-bottom:1px solid var(--border,#e8edf5)}.batch-timeline{list-style:none;padding:12px 0 0 15px;margin:0}.batch-timeline>li{position:relative;padding:0 0 20px 20px;border-left:1px solid #cddde0}.batch-timeline>li:before{content:'';position:absolute;left:-5px;top:14px;width:9px;height:9px;background:var(--database-teal);border-radius:50%}.batch-group{border:1px solid var(--border,#dce4ec);border-radius:6px;overflow:hidden}.batch-group summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:12px;background:var(--bg-page,#f5f8fb);cursor:pointer;font-size:13px}.latest-batch{font-size:10px;font-weight:500;color:var(--database-teal);background:#e1f3f2;border-radius:3px;padding:2px 5px}.batch-body{padding:12px}.text-button{display:inline-flex;align-items:center;gap:4px;cursor:pointer;border:0;background:transparent;color:var(--text-active,#3b5adb);font:inherit;padding:2px 0;text-align:left}.original-data{display:grid;grid-template-columns:125px minmax(0,1fr);font-size:12px;margin:10px 0;border:1px solid var(--border,#e8edf5)}.original-data dt,.original-data dd{margin:0;padding:7px 9px;min-width:0;border-bottom:1px solid var(--border,#e8edf5)}.original-data dt{background:var(--bg-page,#f6f8fa);color:var(--text-muted,#6b7280)}.section-title{font-size:11px;font-weight:600;color:var(--text-muted,#6b7280);padding:14px 0 6px}.tracking-event{border-top:1px solid var(--border,#e8edf5);padding:11px 0}.event-heading{display:flex;justify-content:space-between;gap:10px}.event-heading strong{font-size:12px}.event-heading time{font-size:11px;color:var(--text-muted,#6b7280);white-space:nowrap}.operator{font-size:11px;color:var(--text-muted,#6b7280);margin:5px 0 8px}.changes-table{border:1px solid var(--border,#e8edf5);border-radius:3px;overflow:hidden}.changes-table>div{display:grid;grid-template-columns:115px minmax(0,1fr) minmax(0,1fr);gap:8px;padding:7px 8px;border-bottom:1px solid var(--border,#e8edf5);font-size:11px;min-width:0}.changes-table>div>span{min-width:0}.change-header{background:var(--bg-page,#f5f7fa);color:var(--text-muted,#6b7280);font-weight:600}.no-changes{font-size:11px;color:var(--text-muted,#6b7280);line-height:1.5}
.replay-count-sort-button { display: inline-grid; place-items: center; width: 20px; height: 20px; margin-left: 5px; padding: 0; border: 0; border-radius: 3px; color: #b7c9cc; background: transparent; cursor: pointer; vertical-align: middle; }
.replay-count-sort-button:hover, .replay-count-sort-button:focus-visible { color: #fff; background: rgba(255, 255, 255, .1); }
.replay-count-sort-button.is-active { color: #ffd166; }
.replay-count-sort-button:focus-visible { outline: 1px solid currentColor; outline-offset: 1px; }
.replay-header-filter-button { display: inline-grid; place-items: center; width: 18px; height: 18px; margin-left: 3px; padding: 0; border: 0; background: transparent; cursor: pointer; vertical-align: middle; }
.replay-header-filter-button i { display: block; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 7px solid #e9fff9; filter: drop-shadow(0 0 1px rgba(0,0,0,.7)); }
.replay-header-filter-button:hover i, .replay-header-filter-button:focus-visible i { border-top-color: #fff; }
.replay-header-filter-button.active i { border-top-color: #ffd166; }
.replay-header-filter-button:focus-visible { outline: 1px solid #fff; outline-offset: 1px; }
.replay-header-filter-panel { position: fixed; z-index: 1500; box-sizing: border-box; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 6px; padding: 8px; overflow: hidden; border: 1px solid #8e8e8e; border-radius: 3px; color: #222; background: #454545; box-shadow: 0 8px 22px rgba(0, 0, 0, .32); }
.replay-header-filter-panel > header, .replay-header-filter-panel > footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.replay-header-filter-panel > header { padding: 0 2px; color: #fff; }
.replay-header-filter-panel > header strong { font-size: 13px; }
.replay-header-filter-content { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr); gap: 5px; padding: 7px; border: 0; border-radius: 4px; background: #454545; }
.replay-header-filter-panel > input { width: 100%; height: 28px; padding: 0 8px; border: 1px solid #777; border-radius: 3px; color: #eee; background: #555; font: inherit; }
.replay-header-filter-search { display: flex; gap: 5px; }
.replay-header-filter-search input { flex: 1; min-width: 0; height: 28px; padding: 0 8px; border: 1px solid #777; border-radius: 3px; color: #eee; background: #555; font: inherit; }
.replay-header-filter-search button { width: 28px; border: 1px solid #42b883; border-radius: 3px; color: #fff; background: #42b883; cursor: pointer; }
.replay-header-filter-actions { display: flex; flex-wrap: wrap; gap: 4px 6px; }
.replay-header-filter-actions button { padding: 3px 7px; border: 0; color: #ddd; background: transparent; cursor: pointer; font-size: 11px; }
.replay-header-filter-count { align-self: center; color: #c7c7c7; font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.replay-header-filter-options { min-width: 0; min-height: 0; overflow-x: hidden; overflow-y: auto; display: grid; grid-auto-rows: max-content; align-content: start; gap: 2px; padding: 3px; border-radius: 3px; background: #555; }
.replay-header-filter-options label { box-sizing: border-box; display: grid; grid-template-columns: 13px minmax(0, 1fr) max-content; align-items: start; gap: 8px; width: 100%; min-width: 0; min-height: 23px; padding: 7px 6px; border-radius: 3px; color: #eee; font-size: 12px; line-height: 1.5; cursor: pointer; }
.replay-header-filter-options label:hover { background: #666; }
.replay-header-filter-options label span { white-space: nowrap; overflow-wrap: normal; word-break: normal; }
.replay-header-filter-options label .replay-header-filter-option-label { min-width: 0; white-space: pre-line; overflow-wrap: anywhere; line-height: 1.5; }
.replay-header-filter-options label .replay-header-filter-option-count { min-width: 44px; color: #d8d8d8; text-align: right; font-variant-numeric: tabular-nums; }
.replay-header-filter-options label:hover .replay-header-filter-option-count { background: #666; }
.replay-header-filter-options input { flex: 0 0 auto; margin-top: 2px; accent-color: #42d1a5; }
.replay-header-filter-options p { min-width: 0; margin: 10px 6px; color: #ddd; text-align: left; font-size: 12px; line-height: 1.6; white-space: normal; overflow-wrap: anywhere; }
.replay-header-filter-options p[role="alert"] { color: #ffd0c7; }
.replay-header-filter-panel > footer { padding-top: 5px; border-top: 1px solid #666; }
.replay-header-filter-footer-spacer { flex: 1; }
.replay-header-filter-clear { color: #ffcf8a !important; }
.replay-header-filter-panel .button { min-height: 25px; border-color: #777; color: #eee; background: #555; }
.replay-header-filter-panel .button.primary { border-color: #42b883; color: #fff; background: #42b883; }
.replay-header-filter-resize-handle { position: absolute; right: 1px; bottom: 1px; width: 16px; height: 16px; padding: 0; border: 0; cursor: nwse-resize; touch-action: none; background: linear-gradient(135deg, transparent 0 42%, #bbb 43% 49%, transparent 50% 61%, #ddd 62% 68%, transparent 69%); }

.replay-header-filter-options input{width:13px;min-height:0;height:13px;padding:0}.replay-header-filter-search input{min-height:28px}.replay-header-filter-panel button:disabled{opacity:.5;cursor:not-allowed}
[data-theme="dark"] .database-issues-page{--database-teal:#145c67;--database-row-alt:rgba(126,184,255,.07)}
@media(max-width:960px){.database-toolbar{align-items:flex-start;flex-wrap:wrap;padding:12px}.pagination{padding:10px 12px}.mobile-navigation{display:inline-flex}.toolbar-actions{margin-left:auto}.tracking-drawer{width:min(780px,100vw)}}
@media(max-width:768px){.database-issues-page{--database-content-gutter:12px}.edit-fields{grid-template-columns:1fr}.edit-fields .wide{grid-column:auto}.pagination{justify-content:space-between;gap:8px}}
@media(max-width:600px){.modal-mask{padding:10px}.dialog{max-height:calc(100dvh - 20px);padding:14px}.edit-fields{grid-template-columns:1fr}.database-title h2{font-size:17px}.event-heading{flex-wrap:wrap}.tracking-drawer{padding:12px}.changes-table>div{grid-template-columns:85px minmax(0,1fr) minmax(0,1fr)}}
</style>
