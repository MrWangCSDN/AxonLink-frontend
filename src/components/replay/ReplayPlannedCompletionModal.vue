<template>
  <div v-if="open" class="replay-completion-mask">
    <section class="replay-completion-modal" role="dialog" aria-modal="true" aria-labelledby="completion-modal-title">
      <header class="replay-completion-header">
        <div>
          <h2 id="completion-modal-title">计划完成情况</h2>
          <p>按全量计划验证日期统计，各日期点仅展示实际存在的数据</p>
        </div>
        <button class="replay-completion-close" type="button" aria-label="关闭" @click="emit('close')"><X :size="20" /></button>
      </header>

      <div class="replay-completion-body">
        <div
          ref="splitLayoutRef"
          data-testid="completion-split-layout"
          class="replay-completion-split-layout"
          :class="{ 'is-upper-collapsed': upperCollapsed, 'is-dragging': draggingSplit }"
          :style="splitLayoutStyle"
        >
          <section v-if="!upperCollapsed" data-testid="completion-upper-pane" class="replay-completion-upper-pane">
            <div v-if="error" class="replay-completion-error">{{ error }}</div>
            <template v-if="datePoints.length">
              <section class="replay-completion-timeline-section" aria-label="计划验证日期时间轴">
            <div class="replay-completion-range-fields">
              <label>开始日期<select v-model="startDateInput" data-testid="completion-start-date">
                <option v-for="date in rangeDateOptions" :key="date" :value="date">{{ date }}</option>
              </select></label>
              <span>至</span>
              <label>结束日期<select v-model="endDateInput" data-testid="completion-end-date">
                <option v-for="date in rangeDateOptions" :key="date" :value="date">{{ date }}</option>
              </select></label>
              <button data-testid="apply-completion-range" type="button" :disabled="loading" @click="applyInputRange">查询</button>
              <div class="replay-completion-grouping-switch" role="group" aria-label="计划完成情况统计分组口径" data-testid="completion-grouping-switch">
                <button type="button" data-testid="completion-grouping-domain" :class="{ 'is-active': groupBy === 'domain' }" :aria-pressed="String(groupBy === 'domain')" :disabled="loading" @click="emit('update:groupBy', 'domain')">领域</button>
                <button type="button" data-testid="completion-grouping-issue-domain" :class="{ 'is-active': groupBy === 'issueDomain' }" :aria-pressed="String(groupBy === 'issueDomain')" :disabled="loading" @click="emit('update:groupBy', 'issueDomain')">问题所属领域</button>
              </div>
            </div>

            <div ref="timelineScrollRef" class="replay-completion-timeline-scroll">
              <i data-testid="timeline-center-gutter" class="replay-completion-center-gutter" :style="timelineCenterGutterStyle" aria-hidden="true"></i>
              <div ref="timelineRef" class="replay-completion-timeline" :style="timelineWidthStyle">
                <div class="replay-completion-columns">
                  <div
                    v-for="(point, index) in datePoints"
                    :key="point.date"
                    data-testid="timeline-column"
                    class="replay-completion-column"
                    :class="hasTimelineSelection && index >= startIndex && index <= endIndex ? 'is-selected' : 'is-outside'"
                    role="button"
                    tabindex="0"
                    :aria-label="`查询 ${point.date} 的计划完成情况`"
                    @click="selectDatePoint(point.date)"
                    @keydown.enter.prevent="selectDatePoint(point.date)"
                    @keydown.space.prevent="selectDatePoint(point.date)"
                  >
                    <div class="replay-completion-bar-space">
                      <div class="replay-completion-bar-stack">
                        <span data-testid="timeline-count" class="replay-completion-count">{{ point.plannedCount }}</span>
                        <i data-testid="timeline-bar" class="replay-completion-bar" :style="{ height: barHeight(point.plannedCount) }"></i>
                      </div>
                    </div>
                    <i class="replay-completion-point" aria-hidden="true"></i>
                    <time data-testid="timeline-date">{{ point.date }}</time>
                  </div>
                </div>
                <div ref="sliderShellRef" class="replay-completion-slider-shell" :style="sliderInsetStyle">
                  <div class="replay-completion-slider-track"></div>
                  <div v-if="hasTimelineSelection" class="replay-completion-slider-selection" :style="selectionStyle"></div>
                  <button
                    v-if="rangesOverlap"
                    data-testid="timeline-overlap-handle"
                    class="replay-completion-overlap-handle"
                    type="button"
                    :style="overlapHandleStyle"
                    aria-label="日期端点重合，向左拖动开始日期，向右拖动结束日期"
                    @pointerdown.stop.prevent="startOverlapDrag"
                  ></button>
                  <input
                    v-if="hasTimelineSelection && !rangesOverlap"
                    data-testid="timeline-start-handle"
                    class="replay-completion-range replay-completion-range-start"
                    type="range"
                    min="0"
                    :max="datePoints.length - 1"
                    step="1"
                    :value="startIndex"
                    aria-label="开始日期点"
                    @input="moveStart(Number($event.target.value), false)"
                    @change="moveStart(Number($event.target.value), true)"
                  />
                  <input
                    v-if="hasTimelineSelection && !rangesOverlap"
                    data-testid="timeline-end-handle"
                    class="replay-completion-range replay-completion-range-end"
                    type="range"
                    min="0"
                    :max="datePoints.length - 1"
                    step="1"
                    :value="endIndex"
                    aria-label="结束日期点"
                    @input="moveEnd(Number($event.target.value), false)"
                    @change="moveEnd(Number($event.target.value), true)"
                  />
                </div>
              </div>
              <i data-testid="timeline-center-gutter" class="replay-completion-center-gutter" :style="timelineCenterGutterStyle" aria-hidden="true"></i>
            </div>
              </section>
              <div v-if="dashboard" class="replay-completion-overview">
                <div><span>计划问题数</span><strong>{{ dashboard.summary.plannedTotal }}</strong></div>
                <div><span>已修复</span><strong>{{ dashboard.summary.onTimeFixedCount }}</strong></div>
                <div><span>延期修复</span><strong>{{ dashboard.summary.lateFixedCount }}</strong></div>
                <div><span>未完成</span><strong>{{ dashboard.summary.unfinishedCount }}</strong></div>
                <div><span>延期未完成</span><strong>{{ dashboard.summary.overdueUnfinishedCount }}</strong></div>
                <div><span>完成率</span><strong>{{ rateLabel(dashboard.summary.completionRate) }}</strong></div>
              </div>
              <p v-else-if="loading" class="replay-completion-state">统计数据加载中…</p>
            </template>
            <p v-else-if="loading" class="replay-completion-state">计划日期加载中…</p>
            <p v-else class="replay-completion-state">暂无已填写计划验证日期的问题</p>
          </section>

          <div v-else data-testid="completion-collapsed-summary" class="replay-completion-collapsed-summary">
            <span>{{ startDateInput }} 至 {{ endDateInput }}</span>
            <span>{{ groupBy === 'issueDomain' ? '问题所属领域' : '领域' }}</span>
            <strong>计划问题数 {{ dashboard?.summary?.plannedTotal ?? '-' }}</strong>
          </div>

          <div data-testid="completion-splitter" class="replay-completion-splitter" role="separator" aria-orientation="horizontal">
            <span class="replay-completion-splitter-grip" aria-hidden="true" @pointerdown="startSplitDrag"></span>
            <button data-testid="completion-collapse-upper" type="button" @click="toggleUpperPane">
              {{ upperCollapsed ? '展开筛选与时间轴' : '收起筛选与时间轴' }}
            </button>
          </div>

          <section data-testid="completion-lower-pane" class="replay-completion-lower-pane">
            <template v-if="datePoints.length && dashboard">
            <div class="replay-completion-group-toolbar">
              <div class="replay-completion-group-tabs" role="tablist" aria-label="领域开发负责人切换">
                <button
                  v-for="groupName in groupTabs"
                  :key="groupName"
                  data-testid="completion-group-tab"
                  type="button"
                  role="tab"
                  :data-active="activeGroupName === groupName"
                  :aria-selected="activeGroupName === groupName"
                  :class="{ 'is-active': activeGroupName === groupName }"
                  @click="selectGroup(groupName)"
                >{{ groupName }}/开发负责人</button>
              </div>
              <div class="replay-completion-snapshot-actions">
                <button
                  data-testid="completion-snapshot"
                  class="replay-completion-snapshot-button"
                  type="button"
                  :disabled="loading || snapshotting || !activeGroup"
                  @click="captureSnapshot"
                ><Camera :size="16" />{{ snapshotting ? '拍摄中…' : '拍摄快照' }}</button>
              </div>
            </div>

            <div data-testid="completion-table-stage" class="replay-completion-table-stage">
              <div
                v-if="snapshotEffectActive"
                data-testid="completion-snapshot-effect"
                class="replay-completion-snapshot-effect is-active"
                aria-hidden="true"
              >
                <span class="replay-completion-snapshot-flash"></span>
                <span class="replay-completion-snapshot-shutter"><Camera :size="28" /></span>
              </div>
              <span
                v-if="snapshotMessage"
                data-testid="completion-snapshot-message"
                class="replay-completion-snapshot-message"
                :class="[`is-${snapshotMessageKind}`, { 'is-leaving': snapshotMessageLeaving }]"
                role="status"
                aria-live="polite"
              >{{ snapshotMessage }}</span>
              <div class="replay-completion-table-wrap">
                <table class="replay-completion-table">
                  <thead><tr><th>领域 / 开发负责人</th><th>计划问题数</th><th>已修复</th><th>延期修复</th><th>未完成</th><th>延期未完成</th><th>完成率</th></tr></thead>
                  <tbody v-if="activeGroup">
                    <tr data-testid="completion-group-row" class="replay-completion-group-row">
                      <th>{{ activeGroup.groupName }}</th>
                      <td>{{ activeGroup.plannedTotal }}</td>
                      <td><button type="button" @click="openIssues(activeGroup, null, 'ON_TIME_FIXED')">{{ activeGroup.onTimeFixedCount }}</button></td>
                      <td><button type="button" @click="openIssues(activeGroup, null, 'LATE_FIXED')">{{ activeGroup.lateFixedCount }}</button></td>
                      <td><button type="button" @click="openIssues(activeGroup, null, 'UNFINISHED')">{{ activeGroup.unfinishedCount }}</button></td>
                      <td><button type="button" @click="openIssues(activeGroup, null, 'OVERDUE_UNFINISHED')">{{ activeGroup.overdueUnfinishedCount }}</button></td>
                      <td>{{ rateLabel(activeGroup.completionRate) }}</td>
                    </tr>
                    <tr v-for="developer in sortedActiveDevelopers" :key="developer.matchedDeveloper" data-testid="completion-developer-row" class="replay-completion-developer-row">
                      <th><span>{{ developer.matchedDeveloper }}</span></th>
                      <td>{{ developer.plannedTotal }}</td>
                      <td><button :data-testid="`developer-ON_TIME_FIXED-${developer.matchedDeveloper}`" type="button" @click="openIssues(activeGroup, developer, 'ON_TIME_FIXED')">{{ developer.onTimeFixedCount }}</button></td>
                      <td><button :data-testid="`developer-LATE_FIXED-${developer.matchedDeveloper}`" type="button" @click="openIssues(activeGroup, developer, 'LATE_FIXED')">{{ developer.lateFixedCount }}</button></td>
                      <td><button :data-testid="`developer-UNFINISHED-${developer.matchedDeveloper}`" type="button" @click="openIssues(activeGroup, developer, 'UNFINISHED')">{{ developer.unfinishedCount }}</button></td>
                      <td><button :data-testid="`developer-OVERDUE_UNFINISHED-${developer.matchedDeveloper}`" type="button" @click="openIssues(activeGroup, developer, 'OVERDUE_UNFINISHED')">{{ developer.overdueUnfinishedCount }}</button></td>
                      <td>{{ rateLabel(developer.completionRate) }}</td>
                    </tr>
                  </tbody>
                  <tbody v-else><tr><td class="replay-completion-empty-group" colspan="7">当前时间范围暂无该领域数据</td></tr></tbody>
                </table>
              </div>
            </div>
            </template>
            <p v-else-if="loading" class="replay-completion-state">统计数据加载中…</p>
            <p v-else class="replay-completion-state">暂无可展示的负责人明细</p>
          </section>
        </div>
      </div>

      <aside v-if="drawer.open" data-testid="completion-issue-drawer" class="replay-completion-drawer" aria-label="问题明细">
        <header>
          <div><h3>{{ drawer.title }}</h3><p>{{ startDateInput }} 至 {{ endDateInput }} · 共 {{ drawer.total }} 条</p></div>
          <button type="button" aria-label="关闭问题明细" @click="drawer.open = false"><X :size="18" /></button>
        </header>
        <div class="replay-completion-drawer-body">
          <p v-if="drawer.loading" class="replay-completion-state">明细加载中…</p>
          <p v-else-if="drawer.error" class="replay-completion-error">{{ drawer.error }}</p>
          <article v-for="item in drawer.items" v-else :key="item.id" class="replay-completion-issue-card">
            <h4>
              {{ display(item.issueId) }}
              <span class="replay-completion-status-stack">
                <span class="replay-completion-status-badge">{{ display(item.issueStatus) }}</span>
                <small v-if="overdueDays(item)" data-testid="completion-overdue-days" class="replay-completion-overdue-days">
                  逾期 <strong data-testid="completion-overdue-number" class="replay-completion-overdue-number">{{ overdueDays(item) }}</strong> 天
                </small>
              </span>
            </h4>
            <dl>
              <div><dt>交易</dt><dd>{{ display(item.transactionCode) }} · {{ display(item.transactionName) }}</dd></div>
              <div><dt>计划验证日期</dt><dd>{{ display(item.plannedCompletionDate) }}</dd></div>
              <div><dt>缺陷修复日期</dt><dd>{{ display(item.defectRepairDate) }}</dd></div>
              <div><dt>开发负责人</dt><dd>{{ display(item.matchedDeveloper) }}</dd></div>
              <div><dt>issue_key</dt><dd>{{ display(item.issueKey) }}</dd></div>
            </dl>
          </article>
        </div>
        <footer>
          <button type="button" :disabled="drawer.offset === 0 || drawer.loading" @click="changeDrawerPage(-1)">上一页</button>
          <span>第 {{ drawerPage }} / {{ drawerPageCount }} 页</span>
          <button type="button" :disabled="drawer.offset + drawer.limit >= drawer.total || drawer.loading" @click="changeDrawerPage(1)">下一页</button>
        </footer>
      </aside>

      <div v-if="snapshotPreviewUrl" data-testid="completion-snapshot-preview" class="replay-completion-preview-mask">
        <section class="replay-completion-preview" role="dialog" aria-modal="true" aria-labelledby="completion-snapshot-preview-title">
          <header>
            <div>
              <h3 id="completion-snapshot-preview-title">快照预览</h3>
              <p>快照已保存，请在图片上点击右键，选择“复制图片”</p>
            </div>
            <button data-testid="completion-snapshot-preview-close" type="button" aria-label="关闭快照预览" @click="closeSnapshotPreview"><X :size="20" /></button>
          </header>
          <div class="replay-completion-preview-body">
            <img :src="snapshotPreviewUrl" alt="当前领域计划完成情况快照" />
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Camera, X } from 'lucide-vue-next'
import {
  getReplayCompletionDashboard,
  getReplayCompletionDatePoints,
  getReplayCompletionIssues,
} from '../../api/replayIssues.js'
import {
  buildCompletionSnapshotFilename,
  createCompletionSnapshotBlob,
  downloadAndCopyCompletionSnapshot,
} from './completionSnapshot.js'
import { clampTopHeight, defaultTopHeight } from './replayCompletionSplit.js'
import {
  overlapDragRange,
  timelineCenterGutter,
  timelineIndexFromClientX,
} from './replayCompletionTimeline.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  groupBy: { type: String, default: 'domain' },
})
const emit = defineEmits(['close', 'update:groupBy'])
const columnWidth = 96
const defaultGroupName = '存款组'
const domainGroupTabs = ['存款组', '贷款组', '公共组', '结算组']
const issueDomainGroupTabs = [...domainGroupTabs, '迁移组', '平台组']
const groupTabs = computed(() => props.groupBy === 'issueDomain' ? issueDomainGroupTabs : domainGroupTabs)
const developerNameCollator = new Intl.Collator('zh-CN')
const datePoints = ref([])
const startIndex = ref(-1)
const endIndex = ref(-1)
const startDateInput = ref('')
const endDateInput = ref('')
const dashboard = ref(null)
const activeGroupName = ref(defaultGroupName)
const timelineScrollRef = ref(null)
const timelineRef = ref(null)
const timelineCenterGutterWidth = ref(0)
const sliderShellRef = ref(null)
const splitLayoutRef = ref(null)
const topPaneHeight = ref(0)
const upperCollapsed = ref(false)
const topHeightBeforeCollapse = ref(0)
const draggingSplit = ref(false)
const loading = ref(false)
const error = ref('')
const snapshotting = ref(false)
const snapshotEffectActive = ref(false)
const snapshotMessage = ref('')
const snapshotMessageKind = ref('success')
const snapshotMessageLeaving = ref(false)
const snapshotPreviewUrl = ref('')
const snapshotEffectDuration = 380
const snapshotMessageHoldDuration = 1500
const snapshotMessageFadeDuration = 600
let snapshotEffectTimer = null
let snapshotEffectResolve = null
let snapshotMessageFadeTimer = null
let snapshotMessageRemoveTimer = null
let activePointerId = null
let overlapPointerId = null
let overlapOriginIndex = -1
let overlapEdge = null
let overlapMoved = false
let splitResizeObserver = null
let timelineResizeObserver = null
const drawer = reactive({
  open: false, loading: false, error: '', title: '', total: 0, items: [], limit: 20, offset: 0,
  groupName: '', matchedDeveloper: null, category: '', today: '',
})

const timelineWidthStyle = computed(() => {
  const count = Math.max(1, datePoints.value.length)
  return {
    minWidth: `${count * columnWidth}px`,
    '--timeline-count': count,
  }
})
const timelineCenterGutterStyle = computed(() => ({
  width: `${timelineCenterGutterWidth.value}px`,
}))
const rangeDateOptions = computed(() => [...new Set([
  ...datePoints.value.map(point => point.date),
  startDateInput.value,
  endDateInput.value,
].filter(Boolean))].sort())
const hasTimelineSelection = computed(() => startIndex.value >= 0 && endIndex.value >= 0)
const rangesOverlap = computed(() => hasTimelineSelection.value && startIndex.value === endIndex.value)
const sliderInsetStyle = computed(() => ({
  left: 'calc(50% / var(--timeline-count))',
  right: 'calc(50% / var(--timeline-count))',
}))
const selectionStyle = computed(() => {
  const denominator = Math.max(1, datePoints.value.length - 1)
  return {
    left: `${startIndex.value / denominator * 100}%`,
    right: `${(denominator - endIndex.value) / denominator * 100}%`,
  }
})
const overlapHandleStyle = computed(() => {
  const denominator = Math.max(1, datePoints.value.length - 1)
  return { left: `${startIndex.value / denominator * 100}%` }
})
const maxPlannedCount = computed(() => Math.max(1, ...datePoints.value.map(point => Number(point.plannedCount) || 0)))
const drawerPage = computed(() => Math.floor(drawer.offset / drawer.limit) + 1)
const drawerPageCount = computed(() => Math.max(1, Math.ceil(drawer.total / drawer.limit)))
const activeGroup = computed(() => dashboard.value?.groups?.find(group => group.groupName === activeGroupName.value) || null)
const sortedActiveDevelopers = computed(() => [...(activeGroup.value?.developers || [])].sort((left, right) => {
  const countDifference = Number(right.plannedTotal || 0) - Number(left.plannedTotal || 0)
  return countDifference || developerNameCollator.compare(
    String(left.matchedDeveloper || ''),
    String(right.matchedDeveloper || ''),
  )
}))
const splitLayoutStyle = computed(() => ({
  '--completion-top-height': `${topPaneHeight.value}px`,
}))

function availableSplitHeight() {
  return splitLayoutRef.value?.getBoundingClientRect().height || 0
}

function resetSplitLayout() {
  upperCollapsed.value = false
  topPaneHeight.value = defaultTopHeight(availableSplitHeight() || 760)
  topHeightBeforeCollapse.value = topPaneHeight.value
}

function toggleUpperPane() {
  if (upperCollapsed.value) {
    upperCollapsed.value = false
    topPaneHeight.value = clampTopHeight(topHeightBeforeCollapse.value, availableSplitHeight() || 760)
    return
  }
  topHeightBeforeCollapse.value = topPaneHeight.value
  upperCollapsed.value = true
}

function moveSplitDrag(event) {
  if (!draggingSplit.value || event.pointerId !== activePointerId || upperCollapsed.value) return
  const bounds = splitLayoutRef.value?.getBoundingClientRect()
  if (!bounds) return
  topPaneHeight.value = clampTopHeight(event.clientY - bounds.top, bounds.height)
  topHeightBeforeCollapse.value = topPaneHeight.value
}

function stopSplitDrag(event) {
  if (event && activePointerId !== null && event.pointerId !== activePointerId) return
  draggingSplit.value = false
  activePointerId = null
  window.removeEventListener('pointermove', moveSplitDrag)
  window.removeEventListener('pointerup', stopSplitDrag)
  window.removeEventListener('pointercancel', stopSplitDrag)
}

function startSplitDrag(event) {
  const smallViewport = typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 900px)').matches
  if (upperCollapsed.value || smallViewport) return
  event.preventDefault()
  draggingSplit.value = true
  activePointerId = event.pointerId
  window.addEventListener('pointermove', moveSplitDrag)
  window.addEventListener('pointerup', stopSplitDrag)
  window.addEventListener('pointercancel', stopSplitDrag)
}

function observeSplitLayout() {
  splitResizeObserver?.disconnect()
  if (!splitLayoutRef.value || typeof ResizeObserver === 'undefined') return
  splitResizeObserver = new ResizeObserver(entries => {
    const height = entries[0]?.contentRect?.height || availableSplitHeight()
    if (!upperCollapsed.value) topPaneHeight.value = clampTopHeight(topPaneHeight.value, height)
  })
  splitResizeObserver.observe(splitLayoutRef.value)
}

function updateTimelineCenterGutter() {
  const viewportWidth = timelineScrollRef.value?.clientWidth || 0
  const timelineWidth = timelineRef.value?.getBoundingClientRect().width || 0
  timelineCenterGutterWidth.value = timelineCenterGutter(
    viewportWidth,
    timelineWidth,
    datePoints.value.length,
  )
}

function observeTimelineViewport() {
  timelineResizeObserver?.disconnect()
  updateTimelineCenterGutter()
  if (typeof ResizeObserver === 'undefined') return
  timelineResizeObserver = new ResizeObserver(updateTimelineCenterGutter)
  if (timelineScrollRef.value) timelineResizeObserver.observe(timelineScrollRef.value)
  if (timelineRef.value) timelineResizeObserver.observe(timelineRef.value)
}

function disposeTimelineViewport() {
  timelineResizeObserver?.disconnect()
  timelineResizeObserver = null
  timelineCenterGutterWidth.value = 0
}

function disposeSplitLayout() {
  stopOverlapDrag(null, false)
  stopSplitDrag()
  splitResizeObserver?.disconnect()
  splitResizeObserver = null
  disposeTimelineViewport()
}

function display(value) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function rateLabel(value) {
  return value === undefined || value === null || value === '' ? '-' : `${Number(value).toFixed(2)}%`
}

function parseDateOnly(value) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  return matched ? Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])) : null
}

function overdueDays(item) {
  const comparisonDate = drawer.category === 'LATE_FIXED' ? item.defectRepairDate : drawer.today
  const plannedDateValue = parseDateOnly(item.plannedCompletionDate)
  const comparisonDateValue = parseDateOnly(comparisonDate)
  if (!plannedDateValue || !comparisonDateValue) return 0
  return Math.max(0, Math.round((comparisonDateValue - plannedDateValue) / 86400000))
}

function barHeight(value) {
  return `${Math.max(18, Math.round((Number(value) || 0) / maxPlannedCount.value * 70))}px`
}

function selectGroup(groupName) {
  activeGroupName.value = groupName
  clearSnapshotMessage()
}

function clearSnapshotEffect() {
  if (snapshotEffectTimer) clearTimeout(snapshotEffectTimer)
  snapshotEffectTimer = null
  snapshotEffectActive.value = false
  if (snapshotEffectResolve) snapshotEffectResolve()
  snapshotEffectResolve = null
}

function playSnapshotEffect() {
  clearSnapshotEffect()
  snapshotEffectActive.value = true
  return new Promise(resolve => {
    snapshotEffectResolve = resolve
    snapshotEffectTimer = setTimeout(() => {
      snapshotEffectTimer = null
      snapshotEffectActive.value = false
      snapshotEffectResolve = null
      resolve()
    }, snapshotEffectDuration)
  })
}

function clearSnapshotMessage() {
  if (snapshotMessageFadeTimer) clearTimeout(snapshotMessageFadeTimer)
  if (snapshotMessageRemoveTimer) clearTimeout(snapshotMessageRemoveTimer)
  snapshotMessageFadeTimer = null
  snapshotMessageRemoveTimer = null
  snapshotMessage.value = ''
  snapshotMessageLeaving.value = false
}

function showCopiedMessage() {
  clearSnapshotMessage()
  snapshotMessageKind.value = 'success'
  snapshotMessage.value = '快照已经复制'
  snapshotMessageFadeTimer = setTimeout(() => {
    snapshotMessageFadeTimer = null
    snapshotMessageLeaving.value = true
    snapshotMessageRemoveTimer = setTimeout(() => {
      snapshotMessageRemoveTimer = null
      snapshotMessage.value = ''
      snapshotMessageLeaving.value = false
    }, snapshotMessageFadeDuration)
  }, snapshotMessageHoldDuration)
}

function resetSnapshotFeedback() {
  clearSnapshotEffect()
  clearSnapshotMessage()
  closeSnapshotPreview()
}

function closeSnapshotPreview() {
  const previewUrl = snapshotPreviewUrl.value
  if (!previewUrl) return
  snapshotPreviewUrl.value = ''
  globalThis.URL?.revokeObjectURL?.(previewUrl)
}

async function captureSnapshot() {
  if (!activeGroup.value || loading.value || snapshotting.value) return
  snapshotting.value = true
  clearSnapshotMessage()
  closeSnapshotPreview()
  const effectFinished = playSnapshotEffect()
  drawer.open = false
  const startDate = dashboard.value?.effectiveStartDate || startDateInput.value
  const endDate = dashboard.value?.effectiveEndDate || endDateInput.value
  try {
    const blob = await createCompletionSnapshotBlob({
      group: activeGroup.value,
      developers: sortedActiveDevelopers.value,
      startDate,
      endDate,
    })
    const filename = buildCompletionSnapshotFilename({
      groupName: activeGroup.value.groupName,
      startDate,
      endDate,
    })
    const result = await downloadAndCopyCompletionSnapshot(blob, filename)
    await effectFinished
    snapshotMessageKind.value = result.copied ? 'success' : 'warning'
    if (result.copied) showCopiedMessage()
    else {
      snapshotPreviewUrl.value = result.previewUrl || ''
      snapshotMessage.value = '快照已保存，请右键复制图片'
    }
  } catch {
    await effectFinished
    snapshotMessageKind.value = 'error'
    snapshotMessage.value = '快照生成失败，请重试'
  } finally {
    snapshotting.value = false
  }
}

function indexOfDate(date) {
  return datePoints.value.findIndex(point => point.date === date)
}

function synchronizeRange(startDate, endDate) {
  startDateInput.value = startDate
  endDateInput.value = endDate
  startIndex.value = indexOfDate(startDate)
  endIndex.value = indexOfDate(endDate)
}

async function selectDatePoint(date) {
  if (loading.value) return
  synchronizeRange(date, date)
  await loadDashboard(date, date)
  await nextTick()
  const dateIndex = indexOfDate(date)
  const columns = timelineRef.value?.querySelectorAll('.replay-completion-column')
  columns?.[dateIndex]?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' })
}

async function loadDashboard(startDate, endDate, synchronizeEffective = false) {
  loading.value = true
  error.value = ''
  try {
    const result = await getReplayCompletionDashboard({ startDate, endDate, groupBy: props.groupBy })
    dashboard.value = result
    if (synchronizeEffective) synchronizeRange(result.effectiveStartDate, result.effectiveEndDate)
    drawer.open = false
  } catch (exception) {
    error.value = exception?.message || '计划完成情况加载失败'
  } finally {
    loading.value = false
  }
}

async function initialize() {
  activeGroupName.value = defaultGroupName
  resetSnapshotFeedback()
  snapshotting.value = false
  loading.value = true
  error.value = ''
  dashboard.value = null
  drawer.open = false
  try {
    const result = await getReplayCompletionDatePoints()
    datePoints.value = result?.datePoints || []
    synchronizeRange(result.defaultStartDate, result.defaultEndDate)
    await loadDashboard(result.defaultStartDate, result.defaultEndDate)
    await nextTick()
    resetSplitLayout()
    observeSplitLayout()
    observeTimelineViewport()
    const selectedColumns = timelineScrollRef.value?.querySelectorAll('.replay-completion-column.is-selected')
    selectedColumns?.[selectedColumns.length - 1]?.scrollIntoView?.({ block: 'nearest', inline: 'end' })
  } catch (exception) {
    error.value = exception?.message || '计划验证日期加载失败'
  } finally {
    loading.value = false
  }
}

async function applyInputRange() {
  if (!rangeDateOptions.value.includes(startDateInput.value)
      || !rangeDateOptions.value.includes(endDateInput.value)) {
    error.value = '请选择有效的计划验证日期'
    return
  }
  if (startDateInput.value > endDateInput.value) {
    error.value = '开始日期不能晚于结束日期，请重新选择'
    return
  }
  await loadDashboard(startDateInput.value, endDateInput.value, true)
}

function moveStart(next, commit) {
  startIndex.value = Math.min(next, endIndex.value)
  startDateInput.value = datePoints.value[startIndex.value]?.date || ''
  if (commit) loadDashboard(startDateInput.value, endDateInput.value)
}

function moveEnd(next, commit) {
  endIndex.value = Math.max(next, startIndex.value)
  endDateInput.value = datePoints.value[endIndex.value]?.date || ''
  if (commit) loadDashboard(startDateInput.value, endDateInput.value)
}

function removeOverlapDragListeners() {
  window.removeEventListener('pointermove', moveOverlapDrag)
  window.removeEventListener('pointerup', finishOverlapDrag)
  window.removeEventListener('pointercancel', cancelOverlapDrag)
}

function moveOverlapDrag(event) {
  if (event.pointerId !== overlapPointerId || overlapOriginIndex < 0) return
  const bounds = sliderShellRef.value?.getBoundingClientRect()
  if (!bounds) return
  const nextIndex = timelineIndexFromClientX(
    event.clientX, bounds.left, bounds.width, datePoints.value.length,
  )
  const nextRange = overlapDragRange(overlapOriginIndex, nextIndex, overlapEdge)
  if (!nextRange.edge) return
  overlapEdge = nextRange.edge
  overlapMoved ||= nextRange.startIndex !== overlapOriginIndex || nextRange.endIndex !== overlapOriginIndex
  startIndex.value = nextRange.startIndex
  endIndex.value = nextRange.endIndex
  startDateInput.value = datePoints.value[startIndex.value]?.date || ''
  endDateInput.value = datePoints.value[endIndex.value]?.date || ''
}

function stopOverlapDrag(event, commit) {
  if (event && event.pointerId !== overlapPointerId) return
  removeOverlapDragListeners()
  const shouldQuery = commit && overlapMoved
  overlapPointerId = null
  overlapOriginIndex = -1
  overlapEdge = null
  overlapMoved = false
  if (shouldQuery) loadDashboard(startDateInput.value, endDateInput.value)
}

function finishOverlapDrag(event) {
  stopOverlapDrag(event, true)
}

function cancelOverlapDrag(event) {
  stopOverlapDrag(event, false)
}

function startOverlapDrag(event) {
  if (!rangesOverlap.value || loading.value) return
  overlapPointerId = event.pointerId
  overlapOriginIndex = startIndex.value
  overlapEdge = null
  overlapMoved = false
  window.addEventListener('pointermove', moveOverlapDrag)
  window.addEventListener('pointerup', finishOverlapDrag)
  window.addEventListener('pointercancel', cancelOverlapDrag)
}

const categoryLabels = {
  ON_TIME_FIXED: '已修复',
  LATE_FIXED: '延期修复',
  UNFINISHED: '未完成',
  OVERDUE_UNFINISHED: '延期未完成',
}

async function openIssues(group, developer, category) {
  drawer.open = true
  drawer.groupName = group.groupName
  drawer.matchedDeveloper = developer?.matchedDeveloper ?? null
  drawer.category = category
  drawer.title = `${group.groupName}${developer ? ` · ${developer.matchedDeveloper}` : ''} · ${categoryLabels[category]}`
  drawer.offset = 0
  await loadIssues()
}

async function loadIssues() {
  drawer.loading = true
  drawer.error = ''
  try {
    const result = await getReplayCompletionIssues({
      startDate: startDateInput.value,
      endDate: endDateInput.value,
      groupBy: props.groupBy,
      groupName: drawer.groupName,
      ...(drawer.matchedDeveloper ? { matchedDeveloper: drawer.matchedDeveloper } : {}),
      category: drawer.category,
      limit: drawer.limit,
      offset: drawer.offset,
    })
    drawer.total = result.total
    drawer.items = result.items || []
    drawer.today = result.today || dashboard.value?.today || ''
  } catch (exception) {
    drawer.error = exception?.message || '问题明细加载失败'
  } finally {
    drawer.loading = false
  }
}

function changeDrawerPage(direction) {
  drawer.offset = Math.max(0, drawer.offset + direction * drawer.limit)
  loadIssues()
}

watch(() => props.open, (open) => {
  if (open) initialize()
  else {
    disposeSplitLayout()
    resetSnapshotFeedback()
  }
}, { immediate: true })

watch(() => props.groupBy, async () => {
  if (!props.open || !startDateInput.value || !endDateInput.value) return
  if (!groupTabs.value.includes(activeGroupName.value)) activeGroupName.value = defaultGroupName
  await loadDashboard(startDateInput.value, endDateInput.value)
})

onBeforeUnmount(() => {
  disposeSplitLayout()
  resetSnapshotFeedback()
})
</script>

<style scoped>
.replay-completion-mask{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;padding:3vh 2vw;background:rgba(15,23,42,.48);backdrop-filter:blur(2px)}
.replay-completion-modal{position:relative;display:flex;flex-direction:column;width:96vw;max-width:none;height:94vh;max-height:none;overflow:hidden;border:1px solid #dbe3ef;border-radius:14px;background:var(--bg-card,#fff);color:var(--text-primary,#172033);box-shadow:0 24px 80px rgba(15,23,42,.28)}
.replay-completion-header{display:flex;flex:0 0 auto;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #e5eaf1;background:linear-gradient(180deg,#fff,#fbfcfe)}
.replay-completion-header h2{margin:0;font-size:20px}.replay-completion-header p{margin:4px 0 0;color:#728096;font-size:12px}
.replay-completion-close,.replay-completion-drawer header button{display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:8px;background:transparent;color:#667085;cursor:pointer}.replay-completion-close:hover,.replay-completion-drawer header button:hover{background:#eef3f9;color:#1e293b}
.replay-completion-body{display:flex;flex:1;min-height:0;overflow:hidden;padding:0}.replay-completion-error{padding:10px 12px;border-radius:8px;background:#fff1f0;color:#b42318;font-size:13px}.replay-completion-state{padding:36px;text-align:center;color:#718096}
.replay-completion-split-layout{display:grid;flex:1;min-height:0;grid-template-rows:minmax(0,var(--completion-top-height)) 34px minmax(260px,1fr);padding:0 22px 20px}.replay-completion-split-layout.is-upper-collapsed{grid-template-rows:42px 34px minmax(260px,1fr)}
.replay-completion-upper-pane{min-height:0;overflow:auto}.replay-completion-lower-pane{display:flex;min-height:0;flex-direction:column;padding-top:4px}
.replay-completion-split-layout.is-dragging{user-select:none}.replay-completion-splitter{display:flex;align-items:center;gap:10px;color:#667085}.replay-completion-splitter-grip{flex:1;height:5px;border-radius:3px;background:linear-gradient(180deg,transparent 2px,#d7e0eb 2px,#d7e0eb 3px,transparent 3px);cursor:row-resize}.replay-completion-splitter-grip:hover{background:linear-gradient(180deg,transparent 2px,#7ca8db 2px,#7ca8db 3px,transparent 3px)}.replay-completion-splitter button{height:26px;padding:0 10px;border:1px solid #d6e0ed;border-radius:6px;background:#fff;color:#52657d;font-size:12px;cursor:pointer}.replay-completion-splitter button:hover{border-color:#9fc1ea;color:#176fd1}.replay-completion-collapsed-summary{display:flex;align-items:center;gap:18px;min-height:42px;color:#667085;font-size:13px}.replay-completion-collapsed-summary strong{color:#1e3555}
.replay-completion-timeline-section{padding:8px 0;border-bottom:1px solid #e8edf4}.replay-completion-range-fields{display:flex;align-items:end;gap:10px;margin-bottom:8px}.replay-completion-range-fields label{display:grid;gap:5px;color:#667085;font-size:12px}.replay-completion-range-fields select{width:150px;height:34px;padding:0 30px 0 10px;border:1px solid #cfd8e6;border-radius:6px;background:var(--bg-card,#fff);color:inherit;cursor:pointer}.replay-completion-range-fields>button,.replay-completion-drawer footer button{height:34px;padding:0 14px;border:1px solid #176fd1;border-radius:6px;background:#176fd1;color:#fff;cursor:pointer}.replay-completion-grouping-switch{display:inline-flex;margin-left:auto;padding:3px;border:1px solid #d6e0ed;border-radius:7px;background:#f5f7fb}.replay-completion-grouping-switch button{height:28px;padding:0 12px;border:0;border-radius:5px;background:transparent;color:#667085;font-size:12px;cursor:pointer}.replay-completion-grouping-switch button.is-active{background:#2f6fd6;color:#fff;box-shadow:0 1px 3px rgba(47,111,214,.22)}.replay-completion-grouping-switch button:disabled{cursor:not-allowed;opacity:.55}
.replay-completion-timeline-scroll{display:flex;overflow-x:auto;overflow-y:hidden;padding:1px 0 4px}.replay-completion-center-gutter{flex:0 0 auto;height:1px;pointer-events:none}.replay-completion-timeline{position:relative;flex:0 0 auto;width:100%;padding-bottom:28px}.replay-completion-columns{display:grid;grid-template-columns:repeat(var(--timeline-count),minmax(96px,1fr));height:120px;border-bottom:1px solid #d7dfeb;background:linear-gradient(180deg,rgba(239,245,252,.55),rgba(255,255,255,0))}
.replay-completion-column{display:grid;min-width:0;grid-template-rows:90px 10px 20px;justify-items:center;align-items:end;opacity:.28;cursor:pointer;transition:opacity .16s}.replay-completion-column:hover,.replay-completion-column:focus-visible{opacity:.72;outline:none}.replay-completion-column:focus-visible{box-shadow:inset 0 0 0 2px rgba(47,126,219,.45)}.replay-completion-column.is-selected{opacity:1}.replay-completion-bar-space{display:flex;align-items:end;justify-content:center;width:100%;height:90px}.replay-completion-bar-stack{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}.replay-completion-count{margin-bottom:3px;color:#29476f;font-size:11px;font-weight:700;line-height:16px}.replay-completion-bar{display:block;width:30px;min-height:18px;border-radius:5px 5px 1px 1px;background:#2f7edb;box-shadow:inset 0 1px rgba(255,255,255,.28)}.replay-completion-point{align-self:center;width:7px;height:7px;border:2px solid #fff;border-radius:50%;background:#2f7edb;box-shadow:0 0 0 1px #2f7edb}.replay-completion-column time{align-self:start;color:#667085;font-size:11px;white-space:nowrap}
.replay-completion-slider-shell{position:absolute;bottom:5px;height:18px}.replay-completion-slider-track,.replay-completion-slider-selection{position:absolute;top:8px;height:3px;border-radius:2px}.replay-completion-slider-track{left:0;right:0;background:#d9e2ef}.replay-completion-slider-selection{background:#2f7edb}.replay-completion-overlap-handle{position:absolute;top:1px;z-index:4;width:15px;height:15px;padding:0;border:3px solid #fff;border-radius:50%;background:#2f7edb;box-shadow:0 0 0 1px #2f7edb,0 2px 5px rgba(23,111,209,.25);cursor:ew-resize;transform:translateX(-50%);touch-action:none}.replay-completion-range{position:absolute;inset:0;width:100%;height:18px;margin:0;pointer-events:none;appearance:none;background:transparent}.replay-completion-range::-webkit-slider-thumb{width:15px;height:15px;border:3px solid #fff;border-radius:50%;background:#2f7edb;box-shadow:0 0 0 1px #2f7edb,0 2px 5px rgba(23,111,209,.25);pointer-events:auto;appearance:none;cursor:grab}.replay-completion-range::-moz-range-thumb{width:10px;height:10px;border:3px solid #fff;border-radius:50%;background:#2f7edb;box-shadow:0 0 0 1px #2f7edb;pointer-events:auto;cursor:grab}.replay-completion-range-start{z-index:2}.replay-completion-range-end{z-index:3}
.replay-completion-results{padding-top:18px}.replay-completion-overview{display:grid;grid-template-columns:repeat(6,minmax(118px,1fr));gap:8px;margin:6px 0 0}.replay-completion-overview>div{display:grid;grid-template-columns:1fr auto;align-items:center;gap:5px;padding:7px 10px;border:1px solid #e2e8f1;border-radius:8px;background:#f8fafc}.replay-completion-overview span{color:#718096;font-size:12px}.replay-completion-overview strong{font-size:16px;color:#1e3555}
.replay-completion-table-stage{position:relative;display:flex;flex:1;min-height:0;flex-direction:column;border-radius:9px}.replay-completion-table-wrap{flex:1;min-height:0;max-height:none;overflow:auto;border:1px solid #dfe6ef;border-radius:9px}.replay-completion-table{width:100%;min-width:850px;border-collapse:collapse}.replay-completion-table th,.replay-completion-table td{height:42px;padding:0 13px;border-bottom:1px solid #e8edf3;text-align:right;font-size:13px}.replay-completion-table thead th{position:sticky;top:0;z-index:1;background:#f2f6fb;color:#536176;font-weight:600}.replay-completion-table th:first-child{text-align:left}.replay-completion-table tbody:last-child tr:last-child>*{border-bottom:0}.replay-completion-group-row{background:#f9fbfd}.replay-completion-group-row th{font-weight:700;color:#1f3656}.replay-completion-developer-row th span{display:inline-block;padding-left:22px;color:#5f6e82}.replay-completion-table td button{min-width:36px;padding:4px 9px;border:0;border-radius:5px;background:#edf5ff;color:#176fd1;font-weight:700;cursor:pointer}.replay-completion-table td button:hover{background:#dcecff}
.replay-completion-group-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:2px}.replay-completion-group-tabs{display:flex;min-width:0;gap:8px;overflow-x:auto;padding:2px 0}.replay-completion-group-tabs button{flex:0 0 auto;padding:8px 15px;border:1px solid #d6e0ed;border-radius:7px;background:#f7f9fc;color:#536176;font-size:13px;font-weight:600;cursor:pointer;transition:background .16s,border-color .16s,color .16s}.replay-completion-group-tabs button:hover{border-color:#9fc1ea;color:#176fd1}.replay-completion-group-tabs button.is-active{border-color:#2f7edb;background:#eaf3ff;color:#176fd1;box-shadow:0 0 0 1px rgba(47,126,219,.08)}.replay-completion-snapshot-actions{display:flex;flex:0 0 auto;align-items:center;justify-content:flex-end;gap:10px}.replay-completion-snapshot-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border:1px solid #176fd1;border-radius:7px;background:#176fd1;color:#fff;font-size:13px;font-weight:600;cursor:pointer}.replay-completion-snapshot-button:hover{background:#125fb5}.replay-completion-snapshot-button:disabled{opacity:.45;cursor:not-allowed}.replay-completion-snapshot-effect{position:absolute;inset:0;z-index:4;overflow:hidden;border-radius:9px;pointer-events:none}.replay-completion-snapshot-flash{position:absolute;inset:0;background:#fff;opacity:0;animation:replay-snapshot-flash 160ms ease-out}.replay-completion-snapshot-shutter{position:absolute;top:50%;left:50%;display:grid;place-items:center;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(15,23,42,.8);color:#fff;opacity:0;animation:replay-snapshot-shutter 380ms ease-out}.replay-completion-snapshot-message{position:absolute;left:50%;bottom:16px;z-index:5;max-width:320px;padding:8px 14px;border-radius:7px;background:rgba(23,41,69,.93);color:#fff!important;font-size:12px;white-space:nowrap;transform:translateX(-50%);opacity:1;transition:opacity .6s ease,transform .6s ease}.replay-completion-snapshot-message.is-leaving{opacity:0;transform:translate(-50%,-6px)}.replay-completion-snapshot-message.is-warning{background:rgba(130,76,0,.94)}.replay-completion-snapshot-message.is-error{background:rgba(166,35,27,.94)}.replay-completion-empty-group{text-align:center!important;color:#8a97a8}@keyframes replay-snapshot-flash{0%{opacity:0}24%{opacity:.96}100%{opacity:0}}@keyframes replay-snapshot-shutter{0%{opacity:0;transform:scale(.65)}20%{opacity:1;transform:scale(.65)}48%{opacity:1;transform:scale(1.08)}78%{opacity:1;transform:scale(.92)}100%{opacity:0;transform:scale(.88)}}
.replay-completion-preview-mask{position:absolute;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;padding:28px;background:rgba(15,23,42,.62);backdrop-filter:blur(2px)}
.replay-completion-preview{display:flex;flex-direction:column;width:min(1180px,92%);height:min(820px,90%);overflow:hidden;border:1px solid #dbe3ef;border-radius:12px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.35)}
.replay-completion-preview>header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:16px 18px;border-bottom:1px solid #e4eaf2}.replay-completion-preview h3{margin:0;color:#172033;font-size:17px}.replay-completion-preview header p{margin:5px 0 0;color:#667085;font-size:13px}.replay-completion-preview header button{display:grid;place-items:center;flex:0 0 auto;width:34px;height:34px;padding:0;border:0;border-radius:8px;background:transparent;color:#667085;cursor:pointer}.replay-completion-preview header button:hover{background:#eef3f9;color:#1e293b}
.replay-completion-preview-body{flex:1;min-height:0;overflow:auto;padding:18px;background:#eef2f7;text-align:center}.replay-completion-preview-body img{display:block;max-width:100%;height:auto;margin:0 auto;border:1px solid #d8e0eb;background:#fff;box-shadow:0 8px 28px rgba(15,23,42,.14)}
.replay-completion-drawer{position:absolute;top:0;right:0;bottom:0;z-index:5;display:flex;flex-direction:column;width:min(520px,42vw);border-left:1px solid #d7e0eb;background:var(--bg-card,#fff);box-shadow:-14px 0 36px rgba(15,23,42,.15)}.replay-completion-drawer>header{display:flex;align-items:start;justify-content:space-between;padding:18px;border-bottom:1px solid #e5eaf1}.replay-completion-drawer h3{margin:0;font-size:16px}.replay-completion-drawer header p{margin:5px 0 0;color:#77849a;font-size:12px}.replay-completion-drawer-body{flex:1;overflow:auto;padding:14px}.replay-completion-issue-card{padding:14px;margin-bottom:10px;border:1px solid #e0e7f0;border-radius:9px;background:#fbfcfe}.replay-completion-issue-card h4{display:flex;align-items:flex-start;justify-content:space-between;margin:0 0 10px;color:#1e4f89}.replay-completion-status-stack{display:flex;flex-direction:column;align-items:flex-end;gap:4px}.replay-completion-status-badge{padding:3px 7px;border-radius:4px;background:#edf3fa;color:#52657d;font-size:11px}.replay-completion-overdue-days{color:#667085;font-size:11px;font-weight:500;white-space:nowrap}.replay-completion-overdue-number{color:#d92d20;font-weight:800;font-variant-numeric:tabular-nums}.replay-completion-issue-card dl{display:grid;gap:7px;margin:0}.replay-completion-issue-card dl div{display:grid;grid-template-columns:92px 1fr;gap:8px}.replay-completion-issue-card dt{color:#7a879a;font-size:12px}.replay-completion-issue-card dd{min-width:0;margin:0;overflow-wrap:anywhere;font-size:12px}.replay-completion-drawer footer{display:flex;align-items:center;justify-content:center;gap:12px;padding:12px;border-top:1px solid #e5eaf1;font-size:12px}.replay-completion-drawer footer button{height:30px}.replay-completion-drawer footer button:disabled,.replay-completion-range-fields button:disabled{opacity:.45;cursor:not-allowed}
@media(max-width:900px){.replay-completion-mask{padding:10px}.replay-completion-modal{width:calc(100vw - 20px);height:calc(100vh - 20px)}.replay-completion-body{overflow:auto}.replay-completion-split-layout,.replay-completion-split-layout.is-upper-collapsed{display:block;overflow:visible;padding:0 14px 18px}.replay-completion-upper-pane,.replay-completion-lower-pane{overflow:visible}.replay-completion-splitter{display:none}.replay-completion-collapsed-summary{min-height:46px;flex-wrap:wrap}.replay-completion-table-stage{display:block}.replay-completion-table-wrap{max-height:55vh;overflow:auto}.replay-completion-overview{grid-template-columns:repeat(3,1fr)}.replay-completion-drawer{width:min(560px,88vw)}.replay-completion-range-fields{flex-wrap:wrap}.replay-completion-grouping-switch{width:100%;margin-left:0}.replay-completion-group-toolbar{align-items:flex-start;flex-wrap:wrap}.replay-completion-group-tabs{width:100%}.replay-completion-snapshot-actions{width:100%}.replay-completion-snapshot-message{margin-right:auto;white-space:normal}}
@media(prefers-reduced-motion:reduce){.replay-completion-snapshot-flash,.replay-completion-snapshot-shutter{animation:none;display:none}.replay-completion-snapshot-message{transition-duration:.12s}}
</style>
