<template>
  <div class="audit-backdrop" data-testid="audit-dialog-backdrop">
    <section class="audit-dialog" role="dialog" aria-modal="true" data-testid="registration-audit-dialog">
      <header>
        <div><h3>{{ tableName ? '登记审计明细' : '全局审计日志查询' }}</h3></div>
        <button type="button" data-testid="close-audit-dialog" aria-label="关闭审计窗口" @click="$emit('close')">×</button>
      </header>
      <div class="audit-search-bar">
        <label>表英文名 / 中文名<input v-model.trim="filters.tableKeyword" data-testid="audit-table-filter" type="search" :readonly="Boolean(tableName)" /></label>
        <label>操作人<input v-model.trim="filters.operatorKeyword" data-testid="audit-operator-filter" type="search" /></label>
        <label>操作类型<select v-model="filters.operation"><option value="">全部</option><option value="CREATE">新增登记</option><option value="UPDATE">修改</option><option value="DELETE">删除</option><option value="REREGISTER">重新登记</option><option value="IMPORT">初始化导入</option></select></label>
        <label>开始时间<input v-model="filters.operatedFrom" type="datetime-local" /></label>
        <label>结束时间<input v-model="filters.operatedTo" type="datetime-local" /></label>
        <button type="button" class="search-button" data-testid="audit-search" @click="search">查询</button>
      </div>
      <div class="audit-content">
        <p v-if="loading" class="audit-empty">正在加载审计日志…</p>
        <div v-else-if="error" class="audit-empty audit-error"><p>{{ error }}</p><button type="button" data-testid="audit-retry" @click="search">重试</button></div>
        <p v-else-if="!displayGroups.length" class="audit-empty">{{ tableName ? '暂无审计记录' : '暂无符合条件的审计日志' }}</p>
        <template v-for="group in displayGroups" v-else :key="groupKey(group)">
          <article v-if="!tableName" class="audit-group" data-testid="audit-group">
            <button class="audit-group-summary" type="button" :data-testid="`toggle-audit-group-${group.tableName}`" @click="toggleGroup(group)">
              <strong>{{ tableLabel(group) }}</strong><span>{{ group.matchedEventCount }} 次操作</span><span>最近操作人：{{ personLabel(group.latestOperatorName, group.latestOperatorUsername, group.latestOperatorEmpNo) }}</span><time>{{ group.latestOperatedAt }}</time><b>{{ expandedGroupKeys.has(groupKey(group)) ? '收起' : '展开' }}</b>
            </button>
            <div v-if="expandedGroupKeys.has(groupKey(group))" class="audit-event-list">
              <article v-for="event in sortedGroupEvents(group)" :key="event.id" class="audit-event" :class="eventClass(event.operation)" data-testid="audit-event" :data-event-id="event.id">
                <button class="audit-event-summary" type="button" :data-testid="`toggle-audit-event-${event.id}`" @click="toggleEvent(event)"><span class="operation-badge">{{ operationLabel(event.operation) }}</span><span>{{ eventOperatorLabel(event) }}</span><time>{{ event.operatedAt }}</time><em>本次变更 {{ event.changeCount }} 项</em><b>{{ expandedIds.has(event.id) ? '收起' : '展开' }}</b></button>
                <div v-if="expandedIds.has(event.id)" class="audit-details">
                  <div class="audit-detail-header"><span v-for="column in ['操作人', '动作', '字段', '修改前', '修改后', '时间']" :key="column">{{ column }}</span></div>
                  <div v-for="detail in event.details || []" :key="detail.id" class="audit-detail-row" :data-testid="`audit-detail-${event.id}-${detail.id}`"><span>{{ eventOperatorLabel(event) }}</span><span>{{ changeLabel(detail.changeType) }}</span><span>{{ detail.fieldLabel }}</span><span>{{ displayValue(detail.beforeValue) }}</span><span>{{ displayValue(detail.afterValue) }}</span><span>{{ event.operatedAt }}</span></div>
                  <p v-if="!event.details?.length" class="audit-empty">正在读取本次变更明细…</p>
                  <button v-else type="button" class="copy-details" :data-testid="`copy-audit-event-${event.id}`" @click="copyDetails(event)">{{ copiedEventId === event.id ? '已复制' : '复制全部明细' }}</button>
                </div>
              </article>
            </div>
          </article>
          <template v-else>
            <article v-for="event in sortedGroupEvents(group)" :key="event.id" class="audit-event" :class="eventClass(event.operation)" data-testid="audit-event" :data-event-id="event.id">
              <button class="audit-event-summary" type="button" :data-testid="`toggle-audit-event-${event.id}`" @click="toggleEvent(event)"><span class="operation-badge">{{ operationLabel(event.operation) }}</span><span>{{ eventOperatorLabel(event) }}</span><time>{{ event.operatedAt }}</time><em>本次变更 {{ event.changeCount }} 项</em><b>{{ expandedIds.has(event.id) ? '收起' : '展开' }}</b></button>
              <div v-if="expandedIds.has(event.id)" class="audit-details">
                <div class="audit-detail-header"><span v-for="column in ['操作人', '动作', '字段', '修改前', '修改后', '时间']" :key="column">{{ column }}</span></div>
                <div v-for="detail in event.details || []" :key="detail.id" class="audit-detail-row" :data-testid="`audit-detail-${event.id}-${detail.id}`"><span>{{ eventOperatorLabel(event) }}</span><span>{{ changeLabel(detail.changeType) }}</span><span>{{ detail.fieldLabel }}</span><span>{{ displayValue(detail.beforeValue) }}</span><span>{{ displayValue(detail.afterValue) }}</span><span>{{ event.operatedAt }}</span></div>
                <p v-if="!event.details?.length" class="audit-empty">正在读取本次变更明细…</p>
                <button v-else type="button" class="copy-details" :data-testid="`copy-audit-event-${event.id}`" @click="copyDetails(event)">{{ copiedEventId === event.id ? '已复制' : '复制全部明细' }}</button>
              </div>
            </article>
          </template>
        </template>
      </div>
      <footer>
        <div v-if="!tableName" class="audit-pagination"><span>共 {{ total }} 张表</span><span>第 {{ totalPages ? page + 1 : 0 }} / {{ totalPages }} 页</span><label>每页<select :value="size" data-testid="audit-page-size" @change="changePageSize"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option></select></label><button type="button" :disabled="page <= 0" @click="$emit('pageChange', page - 1)">上一页</button><button type="button" data-testid="audit-next-page" :disabled="page + 1 >= totalPages" @click="$emit('pageChange', page + 1)">下一页</button></div>
        <button type="button" @click="$emit('close')">关闭</button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({ tableName: { type: String, default: '' }, events: { type: Array, default: () => [] }, groups: { type: Array, default: () => [] }, page: { type: Number, default: 0 }, size: { type: Number, default: 20 }, total: { type: Number, default: 0 }, totalPages: { type: Number, default: 0 }, loading: { type: Boolean, default: false }, error: { type: String, default: '' } })
const emit = defineEmits(['search', 'pageChange', 'pageSizeChange', 'loadDetails', 'close'])
const filters = reactive({ tableKeyword: props.tableName, operatorKeyword: '', operation: '', operatedFrom: '', operatedTo: '' })
const expandedGroupKeys = ref(new Set())
const expandedIds = ref(new Set())
const copiedEventId = ref(null)
const operationLabel = operation => ({ CREATE: '新增登记', UPDATE: '修改', DELETE: '删除', REREGISTER: '重新登记', IMPORT: '初始化导入' }[operation] || operation)
const changeLabel = changeType => ({ ADD: '新增', MODIFY: '修改', DELETE: '删除', REORDER: '排序' }[changeType] || changeType)
const eventClass = operation => ({ 'is-delete': operation === 'DELETE', 'is-reregister': operation === 'REREGISTER' })
const displayValue = value => value === null || value === undefined || value === '' ? '—' : value
const sortEvents = events => [...events].sort((left, right) => right.operatedAt.localeCompare(left.operatedAt) || Number(right.id) - Number(left.id))
const displayGroups = computed(() => props.tableName ? [{ schemaName: '', tableName: props.tableName, events: sortEvents(props.events) }] : props.groups)
const sortedGroupEvents = group => sortEvents(group.events || [])
const groupKey = group => `${group.schemaName || ''}\u0000${group.tableName}`
const tableLabel = group => group.tableComment ? `${group.tableName} / ${group.tableComment}` : group.tableName
const personLabel = (name, username, fallback) => {
  const account = username || fallback
  if (!name && !account) return '—'
  if (!name || !account || name === account) return name || account
  return `${name}(${account})`
}
const eventOperatorLabel = event => personLabel(event.operatorName, event.operatorUsername, event.operatorEmpNo)

const resetExpanded = () => { expandedGroupKeys.value = new Set(); expandedIds.value = new Set() }
watch(() => [props.page, props.groups], resetExpanded)
const criteria = () => ({ tableKeyword: filters.tableKeyword, operatorKeyword: filters.operatorKeyword, operations: filters.operation ? [filters.operation] : [], operatedFrom: filters.operatedFrom, operatedTo: filters.operatedTo })
const search = () => { resetExpanded(); emit('search', criteria()) }
const changePageSize = event => { resetExpanded(); emit('pageSizeChange', Number(event.target.value)) }
const toggleGroup = group => { const next = new Set(expandedGroupKeys.value); const key = groupKey(group); next.has(key) ? next.delete(key) : next.add(key); expandedGroupKeys.value = next }
const toggleEvent = event => { const next = new Set(expandedIds.value); if (next.has(event.id)) next.delete(event.id); else { next.add(event.id); if (!event.details) emit('loadDetails', event) } expandedIds.value = next }
const copyDetails = async event => { const content = event.details.map(detail => [eventOperatorLabel(event), changeLabel(detail.changeType), detail.fieldLabel, displayValue(detail.beforeValue), displayValue(detail.afterValue), event.operatedAt].join('｜')).join('\n'); await navigator.clipboard.writeText(content); copiedEventId.value = event.id }
</script>

<style scoped>
.audit-backdrop{position:fixed;inset:0;z-index:1800;display:grid;place-items:center;padding:20px;background:rgba(22,31,41,.46)}.audit-dialog{width:min(1220px,calc(100vw - 40px));height:min(800px,calc(100vh - 40px));display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;overflow:hidden;border-radius:7px;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.24)}.audit-dialog>header,.audit-dialog>footer{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid #dfe6eb}.audit-dialog>footer{border-top:1px solid #dfe6eb;border-bottom:0}.audit-dialog h3,.audit-dialog p{margin:0}.audit-dialog header button{width:30px;height:30px;border:0;color:#66727e;background:transparent;font-size:24px;cursor:pointer}.audit-search-bar{display:grid;grid-template-columns:1.5fr 1fr 1fr 1.25fr 1.25fr auto;gap:10px;align-items:end;padding:12px 18px;border-bottom:1px solid #e1e7eb;background:#f7f9fa}.audit-search-bar label{display:grid;gap:5px;color:#677381;font-size:12px}.audit-search-bar input,.audit-search-bar select,.audit-pagination select{min-width:0;height:32px;padding:0 9px;border:1px solid #cdd7df;border-radius:4px;color:#34414d;background:#fff}.search-button{height:32px;padding:0 18px;border:1px solid #168478;border-radius:4px;color:#fff;background:#168478;cursor:pointer}.audit-content{min-height:0;overflow:auto;padding:14px 18px;background:#f3f6f8}.audit-group{margin-bottom:12px;overflow:hidden;border:1px solid #ccd9df;border-left:4px solid #168478;border-radius:6px;background:#fff}.audit-group-summary{width:100%;display:grid;grid-template-columns:minmax(240px,1fr) 90px 150px 165px 42px;gap:12px;align-items:center;padding:13px 14px;border:0;color:#34414d;background:#fff;text-align:left;cursor:pointer}.audit-group-summary span,.audit-group-summary time{color:#697684;font-size:12px}.audit-group-summary b{color:#168478;font-size:12px}.audit-event-list{padding:10px 12px 2px 24px;border-top:1px solid #e3eaee;background:#f7f9fa}.audit-event{margin-bottom:10px;overflow:hidden;border:1px solid #d8e1e6;border-left:4px solid #168478;border-radius:5px;background:#fff}.audit-event.is-delete{border-left-color:#d84c48}.audit-event.is-reregister{border-left-color:#2c9c62}.audit-event-summary{width:100%;display:grid;grid-template-columns:88px minmax(100px,1fr) 160px 110px 42px;gap:10px;align-items:center;padding:11px 12px;border:0;color:#384552;background:#fff;text-align:left;cursor:pointer}.operation-badge{width:max-content;padding:3px 8px;border-radius:10px;color:#126f66;background:#e5f6f2;font-size:12px}.is-delete .operation-badge{color:#b6322f;background:#ffebe9}.is-reregister .operation-badge{color:#187743;background:#e8f7ee}.audit-event-summary time,.audit-event-summary em{color:#697684;font-size:12px;font-style:normal}.audit-event-summary b{color:#168478;font-size:12px}.audit-details{min-width:840px;padding:0 12px 12px;border-top:1px solid #edf1f3}.audit-detail-header,.audit-detail-row{display:grid;grid-template-columns:100px 70px minmax(160px,1.2fr) minmax(120px,1fr) minmax(120px,1fr) 165px}.audit-detail-header{color:#fff;background:#176f74;font-size:12px}.audit-detail-row{border:1px solid #e1e7eb;border-top:0;color:#45515d;font-size:12px}.audit-detail-header span,.audit-detail-row span{min-width:0;padding:8px;overflow-wrap:anywhere}.audit-detail-header span+span,.audit-detail-row span+span{border-left:1px solid #dce4e8}.copy-details{margin-top:9px;padding:5px 10px;border:1px solid #9fbab8;border-radius:3px;color:#176f74;background:#fff;cursor:pointer}.audit-empty{padding:24px;color:#7b8793;text-align:center}.audit-error{color:#b6322f}.audit-error button{margin-top:12px;padding:6px 16px;border:1px solid #d84c48;border-radius:4px;color:#b6322f;background:#fff}.audit-pagination{display:flex;align-items:center;gap:12px;color:#66727e;font-size:12px}.audit-pagination label{display:flex;align-items:center;gap:6px}.audit-pagination button,.audit-dialog>footer>button{padding:7px 14px;border:1px solid #cbd5dd;border-radius:4px;background:#fff;cursor:pointer}.audit-pagination button:disabled{cursor:not-allowed;opacity:.45}@media(max-width:900px){.audit-search-bar{grid-template-columns:1fr 1fr}.audit-group-summary,.audit-event-summary{min-width:860px}.audit-pagination{flex-wrap:wrap}}
</style>
