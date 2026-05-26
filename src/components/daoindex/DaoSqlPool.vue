<template>
  <div class="dii-page">
    <!-- 顶部 sticky 区：面包屑 + 标题 + 过滤 + 导入按钮 -->
    <div class="dii-sticky">
      <div class="dii-breadcrumb">
        <span class="dii-bc-home">SQL 巡检</span>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M5 3.5L8.5 7L5 10.5" stroke="#C5CBD7" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="dii-bc-current">SQL 池</span>
      </div>

      <div class="dii-header">
        <h2 class="dii-title">SQL 池</h2>
        <div class="dii-header-right">
          <button class="dii-trigger-btn" @click="importOpen = true">
            <span class="dii-trigger-icon">+</span> 导入 Excel
          </button>
        </div>
      </div>

      <!-- 过滤行：工程名 + 白名单 + 关键字 -->
      <div class="dii-filter-row">
        <span class="dii-filter-label">工程：</span>
        <select v-model="projectFilter" class="dii-filter-select" @change="onFilterChange">
          <option value="">全部</option>
          <option v-for="p in projects" :key="p" :value="p">{{ p }}</option>
        </select>

        <span class="dii-filter-label">白名单：</span>
        <select v-model="whitelistFilter" class="dii-filter-select" @change="onFilterChange">
          <option value="">全部</option>
          <option value="0">非白名单</option>
          <option value="1">白名单</option>
        </select>

        <input
          v-model="keyword"
          class="dii-search-input"
          placeholder="搜命名 SQL / SQL 文本…"
          @keyup.enter="onFilterChange"
        />
        <button class="dii-search-btn" @click="onFilterChange">搜索</button>
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
        暂无数据。点击右上角「导入 Excel」开始导入。
      </div>

      <table v-else class="dii-table">
        <thead>
          <tr>
            <th class="col-id">ID</th>
            <th class="col-named">命名 SQL</th>
            <th class="col-sql">SQL</th>
            <th class="col-proj">工程</th>
            <th class="col-env">环境</th>
            <th class="col-rating">巡检结果</th>
            <th class="col-llm">LLM 整改</th>
            <th class="col-time">创建时间</th>
            <th class="col-wl">白名单</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td class="col-id">{{ row.id }}</td>
            <td class="col-named" :title="row.named_sql">
              <code class="dii-named">{{ row.named_sql }}</code>
            </td>
            <td class="col-sql">
              <pre class="dii-sql-pre" :title="row.sql_text">{{ shortSql(row.sql_text) }}</pre>
            </td>
            <td class="col-proj">{{ row.project_name || '-' }}</td>
            <td class="col-env"><span class="dii-env-badge">{{ row.env || '-' }}</span></td>
            <td class="col-rating">
              <span v-if="row.rating_label" :class="ratingClass(row.overall_rating)">
                {{ row.rating_label }}
              </span>
              <span v-else class="dii-muted">—</span>
            </td>
            <td class="col-llm">
              <span v-if="row.llm_fix_verdict === 'NEED_FIX'" class="dii-verdict-fix">待整改</span>
              <span v-else-if="row.llm_fix_verdict === 'NO_NEED'" class="dii-verdict-noneed">无需整改</span>
              <span v-else class="dii-muted">—</span>
            </td>
            <td class="col-time" :title="row.created_at">{{ shortTime(row.created_at) }}</td>
            <td class="col-wl">
              <label class="dii-wl-switch">
                <input
                  type="checkbox"
                  :checked="row.is_whitelist === 1"
                  :disabled="togglingId === row.id"
                  @change="onToggleWhitelist(row, $event)"
                />
                <span class="dii-wl-slider"></span>
              </label>
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

    <!-- 导入弹窗 -->
    <DiiSqlPoolImportModal
      v-model:open="importOpen"
      :default-env="''"
      @imported="onImported"
    />

    <!-- 白名单切换需要口令的小弹窗（首次切换时弹出） -->
    <div v-if="tokenAskOpen" class="dii-modal-mask" @click.self="onTokenCancel">
      <div class="dii-modal" role="dialog">
        <div class="dii-modal-header">
          <h3>输入口令</h3>
          <button class="dii-modal-close" @click="onTokenCancel">×</button>
        </div>
        <div class="dii-modal-body">
          <div class="dii-form-row">
            <label class="dii-form-label">口令</label>
            <input
              ref="askTokenRef"
              v-model="pendingToken"
              type="password"
              class="dii-form-input"
              placeholder="切换白名单需要口令"
              autocomplete="off"
              @keyup.enter="onTokenConfirm"
            />
          </div>
          <div v-if="tokenAskError" class="dii-form-error">{{ tokenAskError }}</div>
        </div>
        <div class="dii-modal-footer">
          <button class="dii-btn dii-btn-ghost" @click="onTokenCancel">取消</button>
          <button class="dii-btn dii-btn-primary" :disabled="!pendingToken" @click="onTokenConfirm">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import {
  listSqlPool,
  listSqlPoolProjects,
  toggleSqlPoolWhitelist,
} from '../../api/daoIndex.js'
import DiiSqlPoolImportModal from './widgets/DiiSqlPoolImportModal.vue'

const items = ref([])
const total = ref(0)
const loading = ref(false)
const errorMsg = ref('')
const page = ref(1)
const pageSize = ref(20)
const projectFilter = ref('')
const whitelistFilter = ref('')
const keyword = ref('')
const projects = ref([])
const importOpen = ref(false)
const togglingId = ref(null)

// 口令缓存：本次会话内有效，避免每次切换都弹
const sessionToken = ref('')
const tokenAskOpen = ref(false)
const tokenAskError = ref('')
const pendingToken = ref('')
const pendingRow = ref(null)
const pendingValue = ref(0)
const askTokenRef = ref(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

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
    const params = {
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value,
    }
    if (projectFilter.value) params.project = projectFilter.value
    if (whitelistFilter.value !== '') params.whitelist = whitelistFilter.value
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const data = await listSqlPool(params)
    items.value = data.items
    total.value = data.total
  } catch (e) {
    errorMsg.value = `加载失败：${e?.message || e}`
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadProjects() {
  try {
    projects.value = await listSqlPoolProjects()
  } catch {
    projects.value = []
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

function onImported() {
  // 导入完成，刷新列表与工程下拉
  page.value = 1
  doLoad()
  loadProjects()
}

/* ─────── 白名单切换 ─────── */
async function onToggleWhitelist(row, ev) {
  const next = ev.target.checked ? 1 : 0
  // 立即把 checkbox 视觉还原到旧值，等接口成功再更新；防止失败时 UI 错位
  ev.target.checked = row.is_whitelist === 1

  if (!sessionToken.value) {
    pendingRow.value = row
    pendingValue.value = next
    pendingToken.value = ''
    tokenAskError.value = ''
    tokenAskOpen.value = true
    await nextTick()
    askTokenRef.value?.focus()
    return
  }
  await doToggle(row, next, sessionToken.value)
}

async function doToggle(row, value, token) {
  togglingId.value = row.id
  try {
    await toggleSqlPoolWhitelist(row.id, value, token)
    row.is_whitelist = value
    sessionToken.value = token  // 成功一次后缓存
  } catch (e) {
    if (e?.code === 'TOKEN_INVALID') {
      // 缓存失效，重新弹窗
      sessionToken.value = ''
      pendingRow.value = row
      pendingValue.value = value
      pendingToken.value = ''
      tokenAskError.value = '口令错误，请重新输入'
      tokenAskOpen.value = true
      await nextTick()
      askTokenRef.value?.focus()
    } else {
      alert(`切换失败：${e?.message || e}`)
    }
  } finally {
    togglingId.value = null
  }
}

async function onTokenConfirm() {
  if (!pendingToken.value || !pendingRow.value) return
  const r = pendingRow.value
  const v = pendingValue.value
  const t = pendingToken.value
  // 立即关闭弹窗，状态切换走 doToggle 的错误处理重弹
  tokenAskOpen.value = false
  await doToggle(r, v, t)
}

function onTokenCancel() {
  tokenAskOpen.value = false
  pendingRow.value = null
}

/* ─────── 行渲染辅助 ─────── */
function shortSql(s) {
  if (!s) return ''
  const oneLine = String(s).replace(/\s+/g, ' ')
  return oneLine.length > 120 ? oneLine.slice(0, 120) + '…' : oneLine
}

function shortTime(s) {
  if (!s) return ''
  return String(s).slice(5, 16)
}

function ratingClass(rating) {
  if (rating === 'POOR') return 'dii-rating-poor'
  if (rating === 'EXCELLENT') return 'dii-rating-excellent'
  if (rating === 'NOT_APPLICABLE') return 'dii-rating-na'
  return 'dii-muted'
}

onMounted(() => {
  doLoad()
  loadProjects()
})
</script>

<style scoped>
/* 复用 token；不允许硬编码颜色（按 CLAUDE.md 规则） */
.dii-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-page, #f6f8fb);
  color: var(--text-primary, #14171c);
  overflow: hidden;
}

.dii-sticky {
  flex: none;
  padding: 14px 24px 8px;
  background: var(--bg-card, #fff);
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
}

.dii-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-secondary, #5a6172);
}
.dii-bc-home {
  color: var(--text-secondary, #5a6172);
}
.dii-bc-current {
  color: var(--text-primary, #14171c);
  font-weight: 500;
}

.dii-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  margin-bottom: 8px;
}
.dii-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #14171c);
}
.dii-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dii-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: var(--text-link, #2563eb);
  color: #fff;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}
.dii-trigger-btn:hover {
  background: var(--text-link-hover, #1d4ed8);
}
.dii-trigger-icon {
  font-size: 16px;
  line-height: 1;
}

.dii-filter-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary, #5a6172);
  flex-wrap: wrap;
}
.dii-filter-label {
  margin-left: 6px;
}
.dii-filter-select {
  padding: 5px 8px;
  background: var(--bg-input, #fff);
  border: 1px solid var(--border, #d4d8dd);
  color: var(--text-primary, #14171c);
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}
.dii-search-input {
  flex: 1;
  min-width: 200px;
  padding: 5px 10px;
  background: var(--bg-input, #fff);
  border: 1px solid var(--border, #d4d8dd);
  color: var(--text-primary, #14171c);
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  margin-left: 8px;
}
.dii-search-input:focus {
  border-color: var(--text-link, #2563eb);
}
.dii-search-btn {
  padding: 5px 14px;
  background: var(--bg-domain-hover, #f5f7fa);
  border: 1px solid var(--border, #d4d8dd);
  color: var(--text-secondary, #5a6172);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}
.dii-search-btn:hover {
  background: var(--bg-card, #fff);
  color: var(--text-primary, #14171c);
}

/* 主体 */
.dii-scroll {
  flex: 1;
  overflow: auto;
  padding: 12px 24px 24px;
}
.dii-loading, .dii-empty, .dii-error {
  padding: 40px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary, #5a6172);
}
.dii-error {
  color: var(--text-error, #cf1124);
}
.dii-retry-btn {
  margin-left: 10px;
  padding: 4px 12px;
  background: transparent;
  border: 1px solid var(--border, #d4d8dd);
  color: var(--text-secondary, #5a6172);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12.5px;
}

/* 表格 */
.dii-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-card, #fff);
  font-size: 13px;
  table-layout: fixed;
}
.dii-table thead th {
  position: sticky;
  top: 0;
  background: var(--bg-table-head, #f5f7fa);
  color: var(--text-secondary, #5a6172);
  font-weight: 500;
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
  white-space: nowrap;
  font-size: 12.5px;
}
.dii-table tbody td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
  vertical-align: top;
}
.dii-table tbody tr:hover {
  background: var(--bg-domain-hover, #f5f7fa);
}

/* 列宽 */
.col-id     { width: 70px; }
.col-named  { width: 220px; }
.col-sql    { /* 自适应 */ }
.col-proj   { width: 130px; }
.col-env    { width: 70px; }
.col-rating { width: 90px; }
.col-llm    { width: 90px; }
.col-time   { width: 110px; }
.col-wl     { width: 80px; text-align: center; }

.dii-named {
  font-family: 'SFMono-Regular', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-primary, #14171c);
  background: var(--bg-domain-hover, #f5f7fa);
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dii-sql-pre {
  margin: 0;
  font-family: 'SFMono-Regular', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-secondary, #5a6172);
  background: transparent;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
  max-height: 60px;
  overflow: hidden;
}

.dii-env-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11.5px;
  background: var(--bg-domain-hover, #f5f7fa);
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 3px;
  color: var(--text-secondary, #5a6172);
}

.dii-muted {
  color: var(--text-secondary, #5a6172);
  opacity: 0.6;
}

.dii-rating-poor {
  padding: 2px 8px;
  font-size: 11.5px;
  background: var(--bg-error-soft, #fff1f0);
  color: var(--text-error, #cf1124);
  border: 1px solid var(--border-error, #ffccc7);
  border-radius: 3px;
}
.dii-rating-excellent {
  padding: 2px 8px;
  font-size: 11.5px;
  background: var(--bg-success-soft, #f6ffed);
  color: var(--text-success, #137333);
  border: 1px solid var(--border-success, #b7eb8f);
  border-radius: 3px;
}
.dii-rating-na {
  padding: 2px 8px;
  font-size: 11.5px;
  background: var(--bg-domain-hover, #f5f7fa);
  color: var(--text-secondary, #5a6172);
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 3px;
}

.dii-verdict-fix {
  padding: 2px 8px;
  font-size: 11.5px;
  color: var(--text-warning, #c08c00);
  border: 1px solid var(--border-warning, #ffd591);
  background: var(--bg-warning-soft, #fffbe6);
  border-radius: 3px;
}
.dii-verdict-noneed {
  padding: 2px 8px;
  font-size: 11.5px;
  color: var(--text-success, #137333);
  border: 1px solid var(--border-success, #b7eb8f);
  background: var(--bg-success-soft, #f6ffed);
  border-radius: 3px;
}

/* 白名单 switch */
.dii-wl-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 18px;
}
.dii-wl-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.dii-wl-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--bg-domain-hover, #d4d8dd);
  border-radius: 18px;
  transition: 0.18s;
}
.dii-wl-slider::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  top: 2px;
  background: var(--bg-card, #fff);
  border-radius: 50%;
  transition: 0.18s;
}
.dii-wl-switch input:checked + .dii-wl-slider {
  background: var(--text-link, #2563eb);
}
.dii-wl-switch input:checked + .dii-wl-slider::before {
  transform: translateX(18px);
}
.dii-wl-switch input:disabled + .dii-wl-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 分页器 */
.dii-pager {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 16px;
  padding: 8px 0;
  font-size: 13px;
  flex-wrap: wrap;
}
.dii-pager-btn {
  min-width: 30px;
  padding: 4px 8px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #d4d8dd);
  color: var(--text-primary, #14171c);
  border-radius: 3px;
  cursor: pointer;
  font-size: 12.5px;
}
.dii-pager-btn:hover:not(:disabled):not(.dii-pager-active) {
  background: var(--bg-domain-hover, #f5f7fa);
}
.dii-pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.dii-pager-active {
  background: var(--text-link, #2563eb);
  border-color: var(--text-link, #2563eb);
  color: #fff;
}
.dii-pager-info {
  margin-left: 12px;
  color: var(--text-secondary, #5a6172);
  font-size: 12.5px;
}
.dii-pager-size {
  padding: 2px 6px;
  background: var(--bg-input, #fff);
  border: 1px solid var(--border, #d4d8dd);
  color: var(--text-primary, #14171c);
  border-radius: 3px;
  font-size: 12px;
  margin: 0 4px;
}

/* 口令小弹窗（与 import modal 同 token 风格） */
.dii-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dii-modal {
  width: 380px;
  max-width: 90vw;
  background: var(--bg-card, #fff);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}
.dii-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px 10px;
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
}
.dii-modal-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #14171c);
}
.dii-modal-close {
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-secondary, #5a6172);
}
.dii-modal-body { padding: 16px 18px; }
.dii-form-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.dii-form-label {
  width: 50px;
  font-size: 13px;
  color: var(--text-secondary, #5a6172);
}
.dii-form-input {
  flex: 1;
  padding: 7px 10px;
  font-size: 13.5px;
  background: var(--bg-input, #fff);
  color: var(--text-primary, #14171c);
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 4px;
  outline: none;
}
.dii-form-input:focus {
  border-color: var(--text-link, #2563eb);
}
.dii-form-error {
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--bg-error-soft, #fff1f0);
  color: var(--text-error, #cf1124);
  border: 1px solid var(--border-error, #ffccc7);
  border-radius: 4px;
  font-size: 12.5px;
}
.dii-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 18px 14px;
  border-top: 1px solid var(--border-subtle, #ebeef2);
}
.dii-btn {
  padding: 6px 16px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
}
.dii-btn-ghost {
  background: transparent;
  border-color: var(--border, #d4d8dd);
  color: var(--text-secondary, #5a6172);
}
.dii-btn-ghost:hover:not(:disabled) {
  background: var(--bg-domain-hover, #f5f7fa);
}
.dii-btn-primary {
  background: var(--text-link, #2563eb);
  color: #fff;
}
.dii-btn-primary:hover:not(:disabled) {
  background: var(--text-link-hover, #1d4ed8);
}
.dii-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* dark 主题：状态色亮一档（按 CLAUDE.md 规则） */
[data-theme="dark"] .dii-rating-poor {
  background: var(--bg-error-soft-dark, #3d1f1f);
  border-color: var(--border-error-dark, #6b3030);
  color: var(--text-error-dark, #ff7a7e);
}
[data-theme="dark"] .dii-rating-excellent {
  background: var(--bg-success-soft-dark, #1e3320);
  border-color: var(--border-success-dark, #2f5a32);
  color: var(--text-success-dark, #6ec78a);
}
[data-theme="dark"] .dii-verdict-fix {
  background: var(--bg-warning-soft-dark, #3a2e15);
  border-color: var(--border-warning-dark, #7a5e1f);
  color: var(--text-warning-dark, #f5c062);
}
[data-theme="dark"] .dii-verdict-noneed {
  background: var(--bg-success-soft-dark, #1e3320);
  border-color: var(--border-success-dark, #2f5a32);
  color: var(--text-success-dark, #6ec78a);
}
[data-theme="dark"] .dii-modal-mask {
  background: rgba(0, 0, 0, 0.6);
}
[data-theme="dark"] .dii-form-error {
  background: var(--bg-error-soft-dark, #3d1f1f);
  border-color: var(--border-error-dark, #6b3030);
  color: var(--text-error-dark, #ff7a7e);
}
[data-theme="dark"] .dii-btn-primary {
  background: var(--text-link-dark, #60a5fa);
  color: #0b1220;
}
[data-theme="dark"] .dii-btn-primary:hover:not(:disabled) {
  background: var(--text-link-hover-dark, #93bbfd);
}
[data-theme="dark"] .dii-trigger-btn {
  background: var(--text-link-dark, #60a5fa);
  color: #0b1220;
}
[data-theme="dark"] .dii-trigger-btn:hover {
  background: var(--text-link-hover-dark, #93bbfd);
}
[data-theme="dark"] .dii-pager-active {
  background: var(--text-link-dark, #60a5fa);
  border-color: var(--text-link-dark, #60a5fa);
  color: #0b1220;
}
</style>
