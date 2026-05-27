<template>
  <div class="dii-page">
    <!-- 顶部 sticky 区：面包屑 + 标题 + env/状态过滤 + 触发按钮 -->
    <div class="dii-sticky">
      <div class="dii-breadcrumb">
        <span class="dii-bc-home">SQL 巡检</span>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M5 3.5L8.5 7L5 10.5" stroke="#C5CBD7" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="dii-bc-current">巡检任务</span>
      </div>

      <div class="dii-header">
        <h2 class="dii-title">巡检任务</h2>
        <div class="dii-header-right">
          <DiiEnvSwitcher :model-value="env" @update:model-value="$emit('update:env', $event)" />
          <button class="dii-trigger-btn" @click="triggerOpen = true">
            <span class="dii-trigger-icon">+</span> 触发任务
          </button>
        </div>
      </div>

      <!-- 状态过滤 -->
      <div class="dii-filter-row">
        <span class="dii-filter-label">状态：</span>
        <select v-model="statusFilter" class="dii-filter-select" @change="onFilterChange">
          <option value="">全部</option>
          <option value="RUNNING_OR_PENDING">进行中</option>
          <option value="DONE">已完成</option>
          <option value="FAILED">失败</option>
        </select>
      </div>
    </div>

    <!-- 列表主体 -->
    <div class="dii-scroll">
      <div v-if="loading && items.length === 0" class="dii-loading">加载中...</div>
      <div v-else-if="errorMsg" class="dii-error">
        {{ errorMsg }}
        <button class="dii-retry-btn" @click="doLoad">重试</button>
      </div>
      <div v-else-if="items.length === 0" class="dii-empty">
        暂无巡检任务
      </div>

      <table v-else class="dii-table">
        <thead>
          <tr>
            <th>任务号</th>
            <th>环境</th>
            <th>状态</th>
            <th>耗时</th>
            <th>触发</th>
            <th>触发时间</th>
            <!-- 4 项统计区，浅色背景圈一起 -->
            <th class="dii-stat-th-start">巡检总数</th>
            <th>执行报错数</th>
            <th>AI 执行整改</th>
            <th>AI 执行报错</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id" :class="{ 'dii-row-running': isRunning(row) }">
            <td class="dii-td-mono">{{ row.task_no }}</td>
            <td><span class="dii-env-badge">{{ row.env }}</span></td>
            <td>
              <span class="dii-status-badge" :class="statusClass(row.status)" :title="row.error_msg || ''">
                {{ statusLabel(row.status) }}
                <span v-if="isRunning(row)" class="dii-pulse-dot"></span>
              </span>
            </td>
            <td>{{ elapsedLabel(row) }}</td>
            <td>{{ triggerLabel(row) }}</td>
            <td :title="row.created_at">{{ shortTime(row.created_at) }}</td>
            <!-- 4 项统计：巡检总数 / 执行报错数 / AI 整改 / AI 报错
                 V14：巡检总数 = item 表本任务下的 total_sqls + 同 env 下 SQL 池条数（pool_count）
                 后端 listBatchTasks 已 LEFT JOIN 池表按 env 聚合，前端只做相加；
                 title 拆显源码扫描 / 导入池两段方便排查 -->
            <td class="dii-stat-cell dii-stat-total"
                :title="`源码扫描 ${fmt(row.total_sqls)} + 导入池 ${fmt(row.pool_count || 0)}`">
              {{ fmt(mergedTotal(row)) }}
            </td>
            <td class="dii-stat-cell dii-stat-err">{{ fmt(row.explain_err) }}</td>
            <td class="dii-stat-cell dii-stat-done">{{ fmt(row.llm_done) }}</td>
            <td class="dii-stat-cell dii-stat-fail">{{ fmt(row.llm_failed) }}</td>
            <td>
              <button class="dii-action-link" @click="onViewSqls(row)">
                查看 SQL 列表 →
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 分页器 -->
      <div v-if="total > 0" class="dii-pager">
        <button class="dii-pager-btn" :disabled="page <= 1" @click="goPage(page - 1)">‹</button>
        <button
          v-for="(p, i) in pagerNumbers"
          :key="i"
          class="dii-pager-btn"
          :class="{ 'dii-pager-active': p === page }"
          :disabled="p === '...'"
          @click="typeof p === 'number' && goPage(p)"
        >{{ p }}</button>
        <button class="dii-pager-btn" :disabled="page >= totalPages" @click="goPage(page + 1)">›</button>
        <span class="dii-pager-info">
          每页
          <select v-model.number="pageSize" @change="goPage(1)" class="dii-pager-size">
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          条 共 {{ total }} 条
        </span>
      </div>
    </div>

    <!-- 触发弹窗 -->
    <DiiTaskTriggerModal
      v-model:open="triggerOpen"
      :env="env"
      @triggered="onTriggered"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import DiiEnvSwitcher from './widgets/DiiEnvSwitcher.vue'
import DiiTaskTriggerModal from './widgets/DiiTaskTriggerModal.vue'
import { listDiiTasks } from '../../api/daoIndex.js'

const props = defineProps({ env: { type: String, default: 'uat' } })
const emit = defineEmits(['update:env', 'goto-sqls'])

const items = ref([])
const total = ref(0)
const loading = ref(false)
const errorMsg = ref('')
const page = ref(1)
const pageSize = ref(20)
const statusFilter = ref('')
const triggerOpen = ref(false)

let pollTimer = null

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

// 分页器数字：当前页周围 ±2 + 首尾 + 省略号
const pagerNumbers = computed(() => {
  const tp = totalPages.value
  const cur = page.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const arr = [1]
  if (cur > 4) arr.push('...')
  for (let p = Math.max(2, cur - 2); p <= Math.min(tp - 1, cur + 2); p++) arr.push(p)
  if (cur < tp - 3) arr.push('...')
  arr.push(tp)
  return arr
})

async function doLoad() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await listDiiTasks({
      env: props.env,
      status: statusFilter.value || undefined,
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value,
    })
    items.value = data.items
    total.value = data.total
    schedulePoll()
  } catch (e) {
    errorMsg.value = `加载失败：${e?.message || e}`
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// 当前页有 PENDING/RUNNING 行 → 启 5s 轮询；否则停
function schedulePoll() {
  const needPoll = items.value.some(r => isRunning(r))
  clearPoll()
  if (needPoll) {
    pollTimer = setInterval(() => doLoad(), 5000)
  }
}
function clearPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function onFilterChange() {
  page.value = 1
  doLoad()
}
function goPage(p) {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  doLoad()
}
function onTriggered(payload) {
  // 触发成功，立即刷一次列表（新任务出现在第一行 RUNNING）
  page.value = 1
  doLoad()
}
function onViewSqls(row) {
  emit('goto-sqls', { taskId: row.id, taskNo: row.task_no })
}

/* ─────── 行渲染辅助 ─────── */
function isRunning(row) {
  return row.status === 'PENDING' || row.status === 'RUNNING'
}
function statusClass(s) {
  return ({
    DONE: 'dii-status-done',
    RUNNING: 'dii-status-running',
    PENDING: 'dii-status-pending',
    FAILED: 'dii-status-failed',
  })[s] || 'dii-status-unknown'
}
function statusLabel(s) {
  return ({ DONE: '已完成', RUNNING: '进行中', PENDING: '等待中', FAILED: '失败' })[s] || s
}
function fmt(n) {
  if (n == null) return '-'
  return Number(n).toLocaleString('en-US')  // 千分位 3,839
}
/**
 * 巡检总数 = 任务 SQL 总数（item 表 task.total_sqls）+ 同 env 下 SQL 池行数（pool_count）。
 * 后端 listBatchTasks 已在响应中带 pool_count；前端只做防御性相加。
 */
function mergedTotal(row) {
  const a = Number(row?.total_sqls) || 0
  const b = Number(row?.pool_count) || 0
  return a + b
}
function progressPct(row) {
  if (!row.total_sqls) return 0
  return Math.min(100, Math.round((row.analyzed_sqls / row.total_sqls) * 100))
}
function elapsedLabel(row) {
  if (!row.created_at) return '-'
  const start = new Date(row.created_at).getTime()
  const end = row.status === 'DONE' || row.status === 'FAILED'
    ? new Date(row.updated_at || row.created_at).getTime()
    : Date.now()
  const sec = Math.max(0, Math.round((end - start) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  const txt = m > 0 ? `${m}m ${s}s` : `${s}s`
  return isRunning(row) ? `进行中 ${txt}` : txt
}
function triggerLabel(row) {
  const t = row.trigger_type === 'SCHEDULED' ? '定时' : '手动'
  return `${t}·${row.owner || '-'}`
}
function shortTime(s) {
  if (!s) return ''
  // '2026-04-29 01:00:05' → '04-29 01:00'
  return String(s).slice(5, 16)
}

/* ─────── 生命周期 ─────── */
onMounted(doLoad)
onBeforeUnmount(clearPoll)
watch(() => props.env, () => { page.value = 1; doLoad() })
</script>

<style scoped>
.dii-page { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

.dii-sticky {
  flex-shrink: 0;
  padding: 18px 24px 14px;
  background: var(--bg-sticky, #fff);
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
}
.dii-breadcrumb { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; }
.dii-bc-home { font-size: 12.5px; color: var(--text-faint, #8990a0); }
.dii-bc-current { font-size: 12.5px; color: var(--text-primary, #14171c); font-weight: 500; }

.dii-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.dii-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--text-primary, #14171c); }
.dii-header-right { display: flex; gap: 10px; align-items: center; }

.dii-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: var(--text-link, #2563eb);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}
.dii-trigger-btn:hover { background: var(--text-link-hover, #1d4ed8); }
.dii-trigger-icon { font-size: 16px; line-height: 1; }

.dii-filter-row { display: flex; gap: 8px; align-items: center; }
.dii-filter-label { font-size: 12.5px; color: var(--text-secondary, #5a6172); }
.dii-filter-select {
  padding: 4px 8px;
  font-size: 12.5px;
  background: var(--bg-input, #fff);
  color: var(--text-primary, #14171c);
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 4px;
}

.dii-scroll { flex: 1; overflow-y: auto; padding: 16px 24px 32px; }
.dii-loading, .dii-empty, .dii-error {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-secondary, #5a6172);
  font-size: 13.5px;
}
.dii-error { color: var(--text-error, #cf1124); }
.dii-retry-btn {
  margin-left: 12px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary, #5a6172);
}

/* 表格 */
.dii-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-subtle, #ebeef2);
  border-radius: 6px;
  overflow: hidden;
}
.dii-table th {
  text-align: left;
  padding: 10px 12px;
  background: var(--bg-thead, #f7f9fc);
  color: var(--text-secondary, #5a6172);
  font-weight: 500;
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
  white-space: nowrap;
}
.dii-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
  color: var(--text-primary, #14171c);
  vertical-align: top;
}
.dii-table tbody tr:hover { background: var(--bg-row-hover, #f9fafc); }
.dii-row-running { background: var(--bg-info-soft, #eef4ff) !important; }

.dii-td-mono { font-family: ui-monospace, monospace; font-size: 12px; }

/* env / status badge */
.dii-env-badge {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-tag, #eef4ff);
  color: var(--text-link, #2563eb);
  border-radius: 3px;
  font-size: 11.5px;
  font-family: ui-monospace, monospace;
}
.dii-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11.5px;
}
.dii-status-done    { background: var(--bg-success-soft, #e6f4ea); color: var(--text-success, #137333); }
.dii-status-running { background: var(--bg-info-soft, #eef4ff);    color: var(--text-link, #2563eb); }
.dii-status-pending { background: var(--bg-tag, #f5f5f5);          color: var(--text-secondary, #5a6172); }
.dii-status-failed  { background: var(--bg-error-soft, #fff1f0);   color: var(--text-error, #cf1124); }

/* 脉冲点 */
.dii-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: dii-pulse 1.4s ease-in-out infinite;
}
.dii-pulse-blue { background: var(--text-link, #2563eb); margin-left: 2px; }
@keyframes dii-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.3); }
}

/* 进度条 */
.dii-progress-text { font-family: ui-monospace, monospace; font-size: 11.5px; color: var(--text-secondary, #5a6172); }
.dii-progress-bar {
  margin-top: 4px;
  height: 4px;
  background: var(--border-subtle, #ebeef2);
  border-radius: 2px;
  overflow: hidden;
  width: 120px;
}
.dii-progress-fill {
  height: 100%;
  background: var(--text-link, #2563eb);
  transition: width 0.4s ease;
}
.dii-progress-extra { margin-top: 4px; font-size: 11px; }
.dii-extra-failed  { color: var(--text-error, #cf1124); margin-right: 6px; }
.dii-extra-skipped { color: var(--text-faint, #8990a0); }

/* 5 项统计区：浅色背景圈起来 */
.dii-stat-th-start, .dii-stat-cell:first-of-type { border-left: 1px solid var(--border-subtle, #ebeef2); }
.dii-stat-cell {
  background: var(--bg-stat-soft, #fafbfd);
  text-align: right;
  font-family: ui-monospace, monospace;
  font-size: 12.5px;
}
/* 4 项统计文字色：总数=中性靛蓝 / 报错=红 / AI 整改=绿 / AI 报错=红 */
.dii-stat-total   { color: var(--text-link, #2563eb); }
.dii-stat-err     { color: var(--text-error, #cf1124); }
.dii-stat-done    { color: var(--text-success, #137333); }
.dii-stat-fail    { color: var(--text-error, #cf1124); }

/* 操作链接 */
.dii-action-link {
  background: transparent;
  border: none;
  color: var(--text-link, #2563eb);
  font-size: 12.5px;
  cursor: pointer;
  padding: 0;
}
.dii-action-link:hover { text-decoration: underline; }

/* 分页器 */
.dii-pager { display: flex; gap: 4px; align-items: center; margin-top: 16px; justify-content: center; flex-wrap: wrap; }
.dii-pager-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12.5px;
  color: var(--text-secondary, #5a6172);
}
.dii-pager-btn:hover:not(:disabled) { background: var(--bg-row-hover, #f5f7fa); }
.dii-pager-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.dii-pager-active { background: var(--text-link, #2563eb) !important; color: #fff !important; border-color: var(--text-link, #2563eb); }
.dii-pager-info { margin-left: 12px; font-size: 12px; color: var(--text-secondary, #5a6172); }
.dii-pager-size {
  margin: 0 4px;
  padding: 1px 4px;
  font-size: 12px;
  background: var(--bg-input, #fff);
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 3px;
}

/* dark 模式：状态色全部改亮一档 */
[data-theme="dark"] .dii-status-done    { background: var(--bg-success-soft-dark, #1e3328); color: var(--text-success-dark, #6ec78a); }
[data-theme="dark"] .dii-status-running { background: var(--bg-info-soft-dark, #1e2a4a);    color: var(--text-link-dark, #60a5fa); }
[data-theme="dark"] .dii-status-pending { background: var(--bg-tag-dark, #2a2d33);          color: var(--text-secondary-dark, #9aa0aa); }
[data-theme="dark"] .dii-status-failed  { background: var(--bg-error-soft-dark, #3d1f1f);   color: var(--text-error-dark, #ff7a7e); }
[data-theme="dark"] .dii-row-running    { background: var(--bg-info-soft-dark, #1e2a4a) !important; }
[data-theme="dark"] .dii-stat-cell      { background: var(--bg-stat-soft-dark, #1c1f25); }
[data-theme="dark"] .dii-stat-total     { color: var(--text-link-dark, #60a5fa); }
[data-theme="dark"] .dii-stat-err       { color: var(--text-error-dark, #ff7a7e); }
[data-theme="dark"] .dii-stat-done      { color: var(--text-success-dark, #6ec78a); }
[data-theme="dark"] .dii-stat-fail      { color: var(--text-error-dark, #ff7a7e); }
</style>
