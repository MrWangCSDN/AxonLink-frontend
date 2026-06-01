<template>
  <div class="dii-page">
    <!-- 顶部 sticky：面包屑 + 标题 + 仓库选择器 -->
    <div class="dii-sticky">
      <div class="dii-breadcrumb">
        <span class="dii-bc-home">源码提交分析</span>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M5 3.5L8.5 7L5 10.5" stroke="#C5CBD7" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="dii-bc-current">概览大屏</span>
      </div>

      <div class="dii-header">
        <div>
          <h2 class="dii-title">代码提交大屏</h2>
          <p class="dii-subtitle" v-if="currentRepo">
            仓库 <strong>{{ currentRepo.repo_name }}</strong>
            <template v-if="snapshotTime"> · 快照 {{ fmtTime(snapshotTime) }}</template>
            <template v-if="currentRepo.last_sync_status"> · {{ currentRepo.last_sync_status }}</template>
          </p>
          <p class="dii-subtitle" v-else>选择一个仓库查看提交占比</p>
        </div>
        <div class="dii-header-right">
          <select
            class="repo-select"
            :value="selectedRepoId"
            @change="selectedRepoId = $event.target.value"
          >
            <option v-for="r in repos" :key="r.id" :value="r.id">{{ r.repo_name }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="dii-scroll">
      <div v-if="loading" class="dii-state">加载中...</div>
      <div v-else-if="errorMsg" class="dii-state dii-state-err">
        {{ errorMsg }}
        <button class="dii-retry-btn" @click="doLoad">重试</button>
      </div>
      <div v-else-if="repos.length === 0" class="dii-state">
        还没有配置代码仓库（code_repo_config.enabled=1），且需先跑过一次采集 + 聚合。
      </div>

      <template v-else>
        <!-- KPI（纯展示，不可点击） -->
        <div class="dii-kpis">
          <div
            v-for="card in kpiCards"
            :key="card.label"
            class="ck-card"
            :class="'is-' + (card.statusTone || 'neutral')"
          >
            <div class="ck-card__label">{{ card.label }}</div>
            <div class="ck-card__value">{{ card.value }}</div>
            <div class="ck-card__meta">{{ card.deltaText || '—' }}</div>
          </div>
        </div>

        <div class="dii-grid-2col">
          <!-- 行员 / 厂商 占比 -->
          <section class="dii-panel">
            <div class="dii-panel-head">
              <div>
                <h3 class="dii-panel-title">行员 / 厂商 代码行数占比</h3>
                <p class="dii-panel-desc">git blame 代码行数（c-/t- 前缀=厂商，否则行员）</p>
              </div>
            </div>
            <DiiPieChart
              :categories="typeCats"
              :series="typeSeries"
              center-label="代码行数"
              value-suffix=" 行"
            />
          </section>

          <!-- 作者存活行 Top -->
          <section class="dii-panel">
            <div class="dii-panel-head">
              <div>
                <h3 class="dii-panel-title">工程代码行数 7 天趋势</h3>
                <p class="dii-panel-desc">每日扫描总行数变化（含行员/厂商拆分）</p>
              </div>
            </div>
            <DiiLineChart
              :categories="trendCats"
              :series="trendSeries"
              :height="240"
            />
          </section>

          <!-- 领域分布（行员/厂商堆叠） -->
          <section class="dii-panel">
            <div class="dii-panel-head">
              <div>
                <h3 class="dii-panel-title">按领域划分（行员 / 厂商）</h3>
                <p class="dii-panel-desc">领域由包路径推导，口径同 DomainSidebar</p>
              </div>
              <div class="dii-legend">
                <span class="dii-legend-item"><i class="dii-swatch sw-staff"></i>行员</span>
                <span class="dii-legend-item"><i class="dii-swatch sw-vendor"></i>厂商</span>
              </div>
            </div>
            <DiiHorizontalStackBar
              :categories="domainCats"
              :series="domainSeries"
            />
          </section>

          <!-- 行员×交易归属（flowtrans XML 维度） -->
          <section class="dii-panel">
            <div class="dii-panel-head">
              <div>
                <h3 class="dii-panel-title">行员代码归属交易</h3>
                <p class="dii-panel-desc">按存活行数排序 · 交易码来自 *.flowtrans.xml blame 归属</p>
              </div>
              <span class="dii-badge-staff">仅行员</span>
            </div>

            <!-- 筛选工具栏 -->
            <div class="person-filters">
              <div class="person-filter-combo">
                <input
                  v-model="personFilterName"
                  class="person-filter-input"
                  placeholder="搜索姓名或交易码…"
                  autocomplete="off"
                  type="text"
                  @input="personDropdownOpen = !!personFilterName.trim()"
                  @focus="personDropdownOpen = !!personFilterName.trim()"
                  @blur="onPersonBlur"
                />
                <!-- 自定义匹配下拉 -->
                <ul
                  v-if="personDropdownOpen && personSuggest.length"
                  class="person-suggest-list"
                >
                  <li
                    v-for="opt in personSuggest"
                    :key="opt.email"
                    class="person-suggest-item"
                    @mousedown.prevent="selectPersonSuggest(opt.name)"
                  >
                    <span class="suggest-name">{{ opt.name }}</span>
                    <span v-if="opt.tx_ids" class="suggest-tx">涉及: {{ opt.tx_ids.split(',').slice(0,3).join(',') }}</span>
                  </li>
                </ul>
                <button
                  v-if="personFilterName"
                  class="person-filter-clear"
                  title="清除"
                  @click="personFilterName = ''; personDropdownOpen = false"
                >×</button>
              </div>
            </div>

            <div v-if="filteredPersonRows.length" class="person-table-wrap">
              <table class="person-table">
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>涉及交易码</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in pagedPersonRows" :key="p.author_email">
                    <td class="cell-name">
                      {{ p.person_name || p.author_email.split('@')[0] }}
                    </td>
                    <td class="cell-tx">
                      <template v-if="p.tx_ids">
                        <span v-for="tx in txList(p.tx_ids, 4)" :key="tx" class="tx-tag">{{ tx }}</span>
                        <span v-if="txCount(p.tx_ids) > 4" class="tx-more">+{{ txCount(p.tx_ids) - 4 }}</span>
                      </template>
                      <span v-else class="tx-none">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <DiiEmptyState
              v-else
              variant="empty"
              :title="personFilterName ? '无匹配结果' : '暂无行员×交易归属数据'"
              :desc="personFilterName ? '请调整筛选条件后重试' : '需仓库中包含 *.flowtrans.xml 且完成采集'"
            />

            <!-- 分页控件 -->
            <div v-if="personTotalPages > 1" class="person-pager">
              <button
                class="pager-btn"
                :disabled="personPage === 1"
                @click="personPage--"
              >‹</button>
              <span class="pager-info">
                第 {{ personPage }} 页
                <span class="pager-sep">/</span>
                共 {{ personTotalPages }} 页
                <span class="pager-total">（{{ filteredPersonRows.length }} 条）</span>
              </span>
              <button
                class="pager-btn"
                :disabled="personPage === personTotalPages"
                @click="personPage++"
              >›</button>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, watchEffect } from 'vue'
import DiiBarGroupChart from '../daoindex/widgets/DiiBarGroupChart.vue'
import DiiHorizontalStackBar from '../daoindex/widgets/DiiHorizontalStackBar.vue'
import DiiPieChart from '../daoindex/widgets/DiiPieChart.vue'
import DiiEmptyState from '../daoindex/widgets/DiiEmptyState.vue'
import DiiLineChart from '../daoindex/widgets/DiiLineChart.vue'
import { getCodeRepos, getCodeOverview, getCodeTrend } from '../../api/codeDashboard.js'

const loading = ref(false)
const errorMsg = ref('')
const repos = ref([])
const selectedRepoId = ref(localStorage.getItem('code-dash-repo') || '')
const overview = ref(null)

const currentRepo = computed(
  () => repos.value.find(r => String(r.id) === String(selectedRepoId.value)) || null
)
const snapshotTime = computed(() => overview.value?.snapshotTime || null)

watch(selectedRepoId, (v) => {
  if (v) localStorage.setItem('code-dash-repo', v)
  loadOverview()
  loadTrend()
})

async function doLoad() {
  loading.value = true
  errorMsg.value = ''
  try {
    const list = await getCodeRepos()
    repos.value = Array.isArray(list) ? list : []
    if (repos.value.length === 0) {
      overview.value = null
      return
    }
    const has = repos.value.some(r => String(r.id) === String(selectedRepoId.value))
    if (!has) selectedRepoId.value = String(repos.value[0].id)
    await loadOverview()
  } catch (e) {
    errorMsg.value = `加载失败：${e?.message || e}`
  } finally {
    loading.value = false
  }
}

async function loadOverview() {
  if (!selectedRepoId.value) return
  try {
    overview.value = await getCodeOverview(selectedRepoId.value)
  } catch (e) {
    errorMsg.value = `加载总览失败：${e?.message || e}`
    overview.value = null
  }
}

onMounted(doLoad)

/* ─── 取数辅助 ─── */
function num(v) { return Number(v) || 0 }
function byTypeRow(t) {
  const arr = overview.value?.byType || []
  return arr.find(r => String(r.person_type).toUpperCase() === t) || {}
}
const staffOwned = computed(() => num(byTypeRow('STAFF').owned_lines))
const vendorOwned = computed(() => num(byTypeRow('VENDOR').owned_lines))
const totalOwned = computed(() =>
  num(overview.value?.totalOwnedLines) || (staffOwned.value + vendorOwned.value)
)
const authorCount = computed(() =>
  (overview.value?.byType || []).reduce((s, r) => s + num(r.author_count), 0)
)
function pct(part) {
  return totalOwned.value === 0 ? '0%'
    : (Math.round(num(part) * 1000 / totalOwned.value) / 10) + '%'
}

/* ─── KPI ─── */
const kpiCards = computed(() => [
  { label: '总代码行数', value: fmt(totalOwned.value), deltaText: '主指标 · git blame', statusTone: 'neutral' },
  { label: '行员代码行数', value: fmt(staffOwned.value), deltaText: `占比 ${pct(staffOwned.value)}`, statusTone: 'success' },
  { label: '厂商代码行数', value: fmt(vendorOwned.value), deltaText: `占比 ${pct(vendorOwned.value)}`, statusTone: 'warning' },
  { label: '作者数', value: fmt(authorCount.value), deltaText: '参与提交的 git 身份', statusTone: 'neutral' },
])

/* ─── 行员/厂商 饼 ─── */
const typeCats = computed(() => ['行员', '厂商'])
const typeSeries = computed(() => [{
  name: '代码行数',
  color: 'var(--c-bar-total, #6366f1)',
  values: [staffOwned.value, vendorOwned.value],
}])

/* ─── 7 天趋势折线图（用每日增量放大斜率，展示仍用总量） ─── */
const trendData = ref([])

function toDelta(arr) {
  return arr.map((v, i) => i === 0 ? 0 : Math.max(0, Number(v) - Number(arr[i - 1])))
}

const trendCats = computed(() =>
  trendData.value.map(r => String(r.stat_date).slice(5))
)

const trendSeries = computed(() => {
  const staffTotals = trendData.value.map(r => Number(r.staff_owned_lines) || 0)
  const vendorTotals = trendData.value.map(r => Number(r.vendor_owned_lines) || 0)

  return [
    {
      name: '行员',
      color: 'var(--c-rating-good, #3b82f6)',
      values: toDelta(staffTotals),
      displayValues: staffTotals,
    },
    {
      name: '厂商',
      color: 'var(--c-rating-poor, #f59e0b)',
      values: toDelta(vendorTotals),
      displayValues: vendorTotals,
    },
  ]
})

async function loadTrend() {
  if (!selectedRepoId.value) return
  try {
    trendData.value = await getCodeTrend(selectedRepoId.value, 7)
  } catch (e) {
    console.error('加载趋势数据失败', e)
  }
}

/* ─── 领域分布（行员/厂商堆叠） ─── */
// domain_key（后端 DomainKeyResolver 口径）→ 中文名。常见域用项目既有中文，
// 生僻键未收录时回退原 key（不臆造），后续按真实仓库补全即可。
const DOMAIN_CN = {
  deposit: '存款',
  loan: '贷款',
  settlement: '结算',
  public: '公共',
  platform: '平台',
  unvr: '通用',
  aggr: '聚合',
  inbu: '内部账务',
  medu: '中间业务',
  stmt: '对账单',
}
function domainCn(key) {
  const k = key || 'public'
  return DOMAIN_CN[k] || k
}
const domains = computed(() => overview.value?.byDomain || [])
const domainCats = computed(() => domains.value.map(d => domainCn(d.domainKey)))
const domainSeries = computed(() => [
  { name: '行员', color: 'var(--c-rating-good, #3b82f6)',
    values: domains.value.map(d => num(d.staffOwned)) },
  { name: '厂商', color: 'var(--c-rating-poor, #f59e0b)',
    values: domains.value.map(d => num(d.vendorOwned)) },
])

/* ─── 交易维度（Phase② 后有数据）：按 tx 聚合行员/厂商 ─── */
const txGrouped = computed(() => {
  const rows = overview.value?.topTx || []
  const map = new Map()
  for (const r of rows) {
    const k = r.tx_id
    if (!map.has(k)) map.set(k, { tx: k, STAFF: 0, VENDOR: 0 })
    const e = map.get(k)
    const t = String(r.person_type).toUpperCase()
    if (t === 'VENDOR') e.VENDOR += num(r.owned_lines)
    else e.STAFF += num(r.owned_lines)
  }
  return [...map.values()].slice(0, 12)
})
const txCats = computed(() => txGrouped.value.map(e => e.tx))
const txSeries = computed(() => [
  { name: '行员', color: 'var(--c-rating-good, #3b82f6)',
    values: txGrouped.value.map(e => e.STAFF) },
  { name: '厂商', color: 'var(--c-rating-poor, #f59e0b)',
    values: txGrouped.value.map(e => e.VENDOR) },
])

/* ─── 人员×交易归属 — 筛选 & 分页 ─── */
// 全量行员选项（供自定义下拉使用），仅包含 STAFF
const allPersonOptions = computed(() =>
  (overview.value?.topPersons || [])
    .filter(p => String(p.person_type).toUpperCase() === 'STAFF')
    .map(p => ({
      email: p.author_email,
      name: p.person_name || String(p.author_email || '').split('@')[0],
      tx_ids: p.tx_ids || '',
    }))
)

const personFilterName    = ref('')
const personDropdownOpen  = ref(false)

// 仅在有输入时才过滤出匹配项，支持姓名/邮箱/交易码搜索
const personSuggest = computed(() => {
  const q = personFilterName.value.trim().toLowerCase()
  if (!q) return []
  return allPersonOptions.value.filter(p => {
    const nameMatch = p.name.toLowerCase().includes(q)
    const emailMatch = p.email.toLowerCase().includes(q)
    const txMatch = p.tx_ids.toLowerCase().split(',').some(tx => tx.trim().includes(q))
    return nameMatch || emailMatch || txMatch
  }).slice(0, 20)
})

function onPersonBlur() {
  // 延迟关闭，让 mousedown.prevent 有时间触发选中
  setTimeout(() => { personDropdownOpen.value = false }, 150)
}
function selectPersonSuggest(name) {
  personFilterName.value  = name
  personDropdownOpen.value = false
}
const personPage       = ref(1)
const PERSON_PAGE_SIZE = 6

const filteredPersonRows = computed(() => {
  let rows = (overview.value?.topPersons || [])
    .filter(p => String(p.person_type).toUpperCase() === 'STAFF')
  const q = personFilterName.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter(p =>
      ((p.person_name || '').toLowerCase().includes(q)) ||
      ((p.author_email || '').toLowerCase().includes(q)) ||
      ((p.tx_ids || '').toLowerCase().split(',').some(tx => tx.trim().includes(q)))
    )
  }
  return rows
})

const personTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredPersonRows.value.length / PERSON_PAGE_SIZE))
)

const pagedPersonRows = computed(() => {
  const start = (personPage.value - 1) * PERSON_PAGE_SIZE
  return filteredPersonRows.value.slice(start, start + PERSON_PAGE_SIZE)
})

// 筛选变化时回到第 1 页
watch(personFilterName, () => { personPage.value = 1 })

// 仓库切换时重置筛选状态
watch(selectedRepoId, () => {
  personFilterName.value   = ''
  personPage.value         = 1
  personDropdownOpen.value = false
})

function txList(ids, max) {
  if (!ids) return []
  return String(ids).split(',').filter(Boolean).slice(0, max)
}
function txCount(ids) {
  if (!ids) return 0
  return String(ids).split(',').filter(Boolean).length
}

/* ─── 工具 ─── */
function fmt(n) {
  if (n == null) return '-'
  return Number(n).toLocaleString('en-US')
}
function fmtTime(s) {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(0, 16)
}
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

.dii-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dii-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--text-primary, #14171c); }
.dii-subtitle { margin: 4px 0 0; font-size: 12.5px; color: var(--text-secondary, #5a6172); }
.dii-subtitle strong { color: var(--text-primary, #14171c); font-family: ui-monospace, monospace; }

.repo-select {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 8px;
  background: var(--bg-input, #fff);
  color: var(--text-secondary, #5a6172);
  font-size: 13px;
  cursor: pointer;
  min-width: 180px;
}

.dii-scroll { flex: 1; overflow-y: auto; padding: 16px 24px 32px; }
.dii-state { text-align: center; padding: 64px 24px; color: var(--text-secondary, #5a6172); font-size: 13.5px; }
.dii-state-err { color: var(--text-error, #cf1124); }
.dii-retry-btn {
  margin-left: 12px; padding: 4px 10px; background: transparent;
  border: 1px solid var(--border, #d4d8dd); border-radius: 4px; cursor: pointer;
  color: var(--text-secondary, #5a6172);
}

.dii-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 1100px) { .dii-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

/* KPI 卡：纯展示（无 hover、无"查看详情"、不可点） */
.ck-card {
  padding: 18px 18px 16px;
  border-radius: 18px;
  border: 1px solid var(--border, #e8edf5);
  background:
    radial-gradient(circle at top right, rgba(121,80,242,0.10), transparent 42%),
    linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.9));
  box-shadow: 0 10px 26px rgba(31, 41, 55, 0.06);
}
.ck-card__label { font-size: 12px; color: var(--text-muted, #8c94a6); letter-spacing: 0.04em; }
.ck-card__value {
  margin-top: 16px;
  font-size: 34px;
  line-height: 1;
  font-weight: 700;
  color: var(--text-primary, #14171c);
  font-variant-numeric: tabular-nums;
}
.ck-card__meta { margin-top: 14px; font-size: 12.5px; color: var(--text-secondary, #5a6172); }

.ck-card.is-success .ck-card__value,
.ck-card.is-success .ck-card__meta { color: var(--build-sync-success-color, #16a34a); }
.ck-card.is-warning .ck-card__value,
.ck-card.is-warning .ck-card__meta { color: #d97706; }
.ck-card.is-danger .ck-card__value,
.ck-card.is-danger .ck-card__meta { color: var(--build-sync-error-color, #dc2626); }

[data-theme="dark"] .ck-card {
  background:
    radial-gradient(circle at top right, rgba(121,80,242,0.18), transparent 42%),
    linear-gradient(180deg, rgba(26,37,64,0.98), rgba(26,37,64,0.92));
  box-shadow: 0 18px 36px rgba(3, 8, 20, 0.2);
}

.dii-grid-2col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 1100px) { .dii-grid-2col { grid-template-columns: 1fr; } }

.dii-panel {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-subtle, #ebeef2);
  border-radius: 8px;
  padding: 18px 20px;
  min-width: 0;
}
.dii-panel-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; margin-bottom: 16px;
}
.dii-panel-title { margin: 0 0 4px; font-size: 15px; font-weight: 600; color: var(--text-primary, #14171c); }
.dii-panel-desc { margin: 0; font-size: 12px; color: var(--text-secondary, #5a6172); }

.dii-legend {
  display: flex; gap: 14px; flex-wrap: wrap; align-items: center;
  font-size: 12px; color: var(--text-secondary, #5a6172);
}
.dii-legend-item { display: inline-flex; align-items: center; gap: 5px; }
.dii-swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.sw-staff  { background: var(--c-rating-good, #3b82f6); }
.sw-vendor { background: var(--c-rating-poor, #f59e0b); }

/* ── 行员×交易归属表格 ── */
.dii-badge-staff {
  flex-shrink: 0;
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
[data-theme="dark"] .dii-badge-staff { background: rgba(59,130,246,0.15); color: #93c5fd; border-color: rgba(59,130,246,0.3); }

.person-table-wrap {
  overflow-x: auto;
  margin: 0 -2px;
}
.person-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.person-table th {
  padding: 6px 10px;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted, #8c94a6);
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
  white-space: nowrap;
}
.person-table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
  vertical-align: middle;
}
.person-table tr:last-child td { border-bottom: none; }
.person-table tr:hover td { background: var(--bg-hover, #f7f8fa); }
[data-theme="dark"] .person-table tr:hover td { background: rgba(255,255,255,0.04); }

.col-r { text-align: right !important; }
.cell-name { font-weight: 500; color: var(--text-primary, #14171c); white-space: nowrap; }
.cell-mono { font-family: ui-monospace, monospace; color: var(--text-secondary, #5a6172); }
.cell-tx { min-width: 160px; }

.tx-tag {
  display: inline-block;
  padding: 1px 6px;
  margin: 1px 3px 1px 0;
  border-radius: 4px;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
  white-space: nowrap;
}
[data-theme="dark"] .tx-tag { background: rgba(34,197,94,0.12); color: #4ade80; border-color: rgba(34,197,94,0.25); }

.tx-more {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  background: var(--bg-subtle, #f3f4f6);
  color: var(--text-muted, #8c94a6);
  border: 1px solid var(--border, #e5e7eb);
}
.tx-none { color: var(--text-faint, #c0c5d0); font-size: 13px; }

/* ── 筛选工具栏 ── */
.person-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.person-filter-combo {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
}
.person-filter-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 28px 0 10px;   /* 右侧留 ×按钮空间 */
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 6px;
  font-size: 12.5px;
  color: var(--text-primary, #14171c);
  background: var(--bg-input, #fff);
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
}
.person-filter-input::placeholder { color: var(--text-faint, #c0c5d0); }
.person-filter-input:focus { border-color: var(--accent, #6366f1); }
[data-theme="dark"] .person-filter-input { background: rgba(255,255,255,0.05); }

.person-filter-clear {
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent;
  color: var(--text-faint, #c0c5d0);
  font-size: 14px; line-height: 1;
  cursor: pointer; padding: 0;
  border-radius: 50%;
  transition: color 0.12s, background 0.12s;
}
.person-filter-clear:hover { color: var(--text-secondary, #5a6172); background: var(--bg-hover, #f0f2f5); }

/* ── 自定义匹配下拉 ── */
.person-suggest-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  z-index: 200;
  margin: 0; padding: 4px 0;
  list-style: none;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.10);
  max-height: 200px;
  overflow-y: auto;
}
[data-theme="dark"] .person-suggest-list {
  background: #1e293b;
  border-color: rgba(255,255,255,0.12);
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
}
.person-suggest-item {
  padding: 7px 12px;
  font-size: 13px;
  color: var(--text-primary, #14171c);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.1s;
}
.person-suggest-item:hover { background: var(--bg-hover, #f3f4f6); }
.person-suggest-item .suggest-name { font-weight: 500; }
.person-suggest-item .suggest-tx {
  margin-left: 8px;
  font-size: 11px;
  color: var(--text-muted, #8c94a6);
  font-family: ui-monospace, monospace;
}
[data-theme="dark"] .person-suggest-item:hover { background: rgba(255,255,255,0.07); }

.person-filter-select {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 6px;
  font-size: 12.5px;
  color: var(--text-secondary, #5a6172);
  background: var(--bg-input, #fff);
  cursor: pointer;
  outline: none;
  white-space: nowrap;
}
.person-filter-select:focus { border-color: var(--accent, #6366f1); }
[data-theme="dark"] .person-filter-select { background: rgba(255,255,255,0.05); color: var(--text-primary, #e2e8f0); }

/* ── 分页控件 ── */
.person-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle, #ebeef2);
}
.pager-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 6px;
  background: var(--bg-card, #fff);
  color: var(--text-secondary, #5a6172);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  padding: 0;
}
.pager-btn:hover:not(:disabled) {
  background: var(--bg-hover, #f0f2f5);
  border-color: var(--accent, #6366f1);
  color: var(--accent, #6366f1);
}
.pager-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
[data-theme="dark"] .pager-btn { background: rgba(255,255,255,0.06); }

.pager-info {
  font-size: 12.5px;
  color: var(--text-secondary, #5a6172);
}
.pager-sep { margin: 0 4px; color: var(--text-faint, #c0c5d0); }
.pager-total { margin-left: 4px; color: var(--text-faint, #c0c5d0); font-size: 11.5px; }
</style>
