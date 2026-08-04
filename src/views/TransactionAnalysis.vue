<template>
  <div class="page-layout">
    <AppHeader ref="appHeaderRef" :isDark="isDark"
               @search="handleGlobalSearch"
               @toggleTheme="toggleTheme"
               @navigate-todo="onNavigateTodo"
               @navigate-slow-todo="onNavigateSlowTodo" />

    <div class="page-body">
      <ChainImpactSidebar
        :class="{ 'is-mobile-open': mobileNavigationOpen }"
        :domains="domains"
        :active-domain-id="activeDomain?.id"
        :system-stats="systemStats"
        :total-transactions="systemStats.totalTransactions || 0"
        :impact-stats="impactStats"
        :current-page="currentPage"
        :impact-mode="impactMode"
        @select-domain="onSelectDomainNav"
        @select-impact-mode="onSelectImpactMode"
        @select-dii-page="onSelectDiiPage"
        @select-replay-page="onSelectReplayPage"
        @select-code-page="onSelectCodePage"
      />
      <button
        v-if="currentPage === 'replay-issues' && mobileNavigationOpen"
        class="replay-mobile-backdrop"
        type="button"
        aria-label="关闭导航"
        @click="mobileNavigationOpen = false"
      />

      <main v-show="currentPage === 'chain'" class="main-content">
        <!-- ── 固定头部：面包屑 + 标题栏 + 统计栏（滚动时不动） ── -->
        <div class="sticky-header">
          <div class="header-topbar">
            <div class="breadcrumb">
              <span class="breadcrumb-home">领域交易</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3.5L8.5 7L5 10.5" stroke="#C5CBD7" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span class="breadcrumb-current">{{ activeDomain?.displayName || activeDomain?.name }}</span>
            </div>
          </div>

          <!-- 页面标题栏 -->
          <div class="content-header">
            <div class="content-title-group">
              <h2 class="content-title">{{ activeDomain?.displayName || activeDomain?.name }}</h2>
              <span class="tx-count-badge">{{ totalCount || activeDomain?.count || sortedTransactions.length }} 支交易</span>
              <div class="build-sync-inline" :class="`is-${buildSyncInfo.statusType}`">
                <div class="build-sync-meta">
                  <span class="build-sync-label">分支</span>
                  <span class="build-sync-value">{{ buildSyncInfo.branch }}</span>
                </div>
                <div class="build-sync-meta build-sync-version-wrap">
                  <span class="build-sync-label">版本</span>
                  <span class="build-sync-value build-sync-version" :title="buildSyncInfo.versionNo">{{ buildSyncInfo.versionNo }}</span>
                </div>
                <div class="build-sync-meta">
                  <span class="build-sync-label">状态</span>
                  <span class="build-sync-status-pill">{{ buildSyncInfo.statusText }}</span>
                </div>
              </div>
            </div>
            <div class="content-actions">
              <div class="domain-search">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="#8C94A6" stroke-width="1.4"/>
                  <path d="M10 10L13 13" stroke="#8C94A6" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
                <input
                  v-model="localSearch"
                  type="text"
                  placeholder="搜索当前领域交易..."
                  class="domain-search-input"
                />
              </div>
              <button class="action-btn" @click="expandAll">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 5L7 2L12 5v4L7 12L2 9V5z" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M7 5v4M4.5 6.5L7 5L9.5 6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                全部展开
              </button>
              <button class="action-btn" @click="collapseAll">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 5L7 2L12 5v4L7 12L2 9V5z" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M7 9V5M4.5 7.5L7 9L9.5 7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                全部收起
              </button>
              <button class="action-btn error-code-export-all" @click="downloadAllErrorCodes">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                全量错误码下载
              </button>
            </div>
          </div>

          <!-- 统计栏 + 全部展开/全部关闭按钮（分页模式下，按钮只对当前页生效） -->
          <div class="stats-bar">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 2L13 5.5v4L7.5 13L2 9.5v-4L7.5 2z" stroke="#4F7CFF" stroke-width="1.4"/>
              <circle cx="7.5" cy="7.5" r="2" fill="#4F7CFF"/>
            </svg>
            <span class="stats-text">
              <template v-if="globalResult">
                精确匹配：<em style="color:#4F7CFF;font-style:normal;font-weight:600;">{{ globalQuery }}</em>
                &nbsp;·&nbsp;{{ globalResult.domain }}
              </template>
              <template v-else-if="globalNotFound">
                交易码「<em style="color:#FF4D4F;font-style:normal;">{{ globalQuery }}</em>」暂无此交易
              </template>
              <template v-else-if="activeKeyword">
                搜索「<em style="color:#4F7CFF;font-style:normal;">{{ activeKeyword }}</em>」共匹配 {{ totalCount }} 支，第 {{ currentPageNum }} / {{ totalPages }} 页
              </template>
              <template v-else>
                共 {{ totalCount || activeDomain?.count || 0 }} 支联机交易，第 {{ currentPageNum }} / {{ totalPages }} 页
              </template>
            </span>
            <!-- 全部展开 / 全部关闭：仅作用于当前页已渲染的卡片 -->
            <div v-if="!globalResult && !globalNotFound && allTransactions.length > 0" class="bulk-toggle">
              <button class="bulk-btn" @click="expandAllCards" :disabled="isLoading">全部展开</button>
              <button class="bulk-btn" @click="collapseAllCards" :disabled="isLoading">全部关闭</button>
            </div>
          </div>
        </div>

        <!-- ── 可滚动区域：只有卡片列表滚动 ── -->
        <div ref="mainRef" class="cards-scroll">
        <!-- 交易卡片列表（覆盖式分页：每页 10 条；切页时整列表替换，旧卡片随 v-for 卸载） -->
        <div class="transaction-list">
          <TransactionCard
            v-for="tx in sortedTransactions"
            :key="tx.id"
            :transaction="tx"
            :default-expanded="false"
            :isDark="isDark"
            :ref="el => { if (el) cardRefs[tx.id] = el; else delete cardRefs[tx.id] }"
          />

          <!-- 加载中提示（覆盖式分页期间，列表暂时为空） -->
          <div v-if="isLoading && sortedTransactions.length === 0" class="loading-more">
            <svg class="loading-spin" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7" stroke="#E8EDF5" stroke-width="2"/>
              <path d="M9 2a7 7 0 0 1 7 7" stroke="#4F7CFF" stroke-width="2" stroke-linecap="round"/>
            </svg>
            加载中...
          </div>

          <!-- 错误提示 -->
          <div v-if="loadError" class="error-state">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="#FF4D4F" stroke-width="1.5"/>
              <path d="M16 10v8M16 21v1" stroke="#FF4D4F" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p>{{ loadError }}</p>
          </div>

          <div v-else-if="!isLoading && sortedTransactions.length === 0" class="empty-state">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="#E8EDF5" stroke-width="2"/>
              <path d="M16 24h16M24 16v16" stroke="#C5CBD7" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <template v-if="globalNotFound">
              <p>暂无交易</p>
              <span>交易码「{{ globalQuery }}」不存在，请确认后重新输入</span>
            </template>
            <template v-else>
              <p>未找到匹配的交易</p>
              <span>尝试调整搜索关键词</span>
            </template>
          </div>

          <!-- 分页器：仅在普通领域列表展示（精确搜索 / 未找到 时不显示） -->
          <div v-if="!globalResult && !globalNotFound && totalCount > 0" class="pager">
            <button class="pager-btn" :disabled="currentPageNum <= 1 || isLoading" @click="goToPage(currentPageNum - 1)">‹</button>
            <button
              v-for="(p, i) in pagerNumbers"
              :key="i"
              class="pager-btn"
              :class="{ 'pager-active': p === currentPageNum }"
              :disabled="p === '...' || isLoading"
              @click="typeof p === 'number' && goToPage(p)"
            >{{ p }}</button>
            <button class="pager-btn" :disabled="currentPageNum >= totalPages || isLoading" @click="goToPage(currentPageNum + 1)">›</button>
            <span class="pager-info">每页 {{ PAGE_SIZE }} 条 共 {{ totalCount }} 支</span>
          </div>
        </div>
        </div><!-- /cards-scroll -->
      </main>

      <ImpactAnalysisPage
        v-show="currentPage === 'impact'"
        class="impact-main"
        :mode="impactMode"
        :selected-id="impactSelectedId"
        :result="impactResult"
        :all-items="impactAllItems"
        :can-export-current="!!impactSelectedId"
        :can-export-all="impactAllItems.length > 0"
        :export-current-loading="impactExportingCurrent"
        :export-all-loading="impactExportingAll"
        :notice="impactNotice"
        @select-item="onImpactSelectItem"
        @export-current="onExportImpactCurrent"
        @export-all="onExportImpactAll"
        @dismiss-notice="dismissImpactNotice"
      />

      <!-- ══════════ SQL 巡检模块 ══════════ -->
      <DaoIndexPage
        ref="daoIndexPageRef"
        v-show="currentPage.startsWith('dii-')"
        class="impact-main"
        :current-page="currentPage"
        @navigate-page="currentPage = $event"
      />

      <ReplayIssuePage
        v-show="currentPage === 'replay-issues'"
        class="impact-main"
        @toggle-navigation="mobileNavigationOpen = !mobileNavigationOpen"
      />

      <!-- ══════════ 源码提交分析大屏 ══════════ -->
      <CodeDashboard
        v-show="currentPage === 'code-dashboard'"
        class="impact-main"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import ChainImpactSidebar from '../components/ChainImpactSidebar.vue'
import TransactionCard from '../components/TransactionCard.vue'
import ImpactAnalysisPage from '../components/impact/ImpactAnalysisPage.vue'
import DaoIndexPage from '../components/daoindex/DaoIndexPage.vue'
import ReplayIssuePage from '../components/replay/ReplayIssuePage.vue'
import CodeDashboard from '../components/code-dashboard/CodeDashboard.vue'
import {
  getAllTables,
  getAllComponents,
  getAllServices,
  analyzeImpact,
} from '../utils/impactAnalysis.js'
import { isImpactMockEnabled, getMockImpactTransactions } from '../mocks/impactHierarchyMock.js'
import {
  getNeo4jTableCatalog,
  getBuildSyncStatus,
  getFlowtranComponentCatalog,
  getFlowtranComponentImpact,
  exportFlowtranImpactAll,
  exportFlowtranImpactCurrent,
  getFlowtranServiceCatalog,
  getFlowtranServiceImpact,
  getFlowtranDomains as getDomains,
  getFlowtranTransactions as getTransactions,
  getFlowtranChain as getChain,
  getFlowtranImpactStats,
  getFlowtranTableImpact,
  getSystemStats,
  exportAllErrorCodes,
} from '../api/index.js'

const PAGE_SIZE = 10

// ── 日/夜模式 ──
const isDark = ref(localStorage.getItem('theme') === 'dark')

const applyTheme = (dark) => {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  applyTheme(isDark.value)
}

// ── 状态 ──
const appHeaderRef = ref(null)
// V16：DaoIndexPage 引用，铃铛点击后调用 openMyWhitelistTodo() 切页 + 启用过滤
const daoIndexPageRef = ref(null)
function onNavigateTodo() {
  // 切到 SQL 分析页（v-show 不会立刻挂载组件，但 DaoIndexPage 一直挂载所以 ref 可用）
  daoIndexPageRef.value?.openMyWhitelistTodo()
}
function onNavigateSlowTodo() {
  // 切到慢SQL维度分析页并打开「我的待审」过滤
  daoIndexPageRef.value?.openMySlowTodo()
}
const domains      = ref([])
const activeDomain = ref(null)
const systemStats  = ref({ totalDomains: 0, totalTransactions: 0, status: 'normal', statusText: '系统运行正常' })
const buildSyncInfo = ref({
  project: 'axon-link-server',
  branch: 'Master',
  versionNo: '--',
  statusText: '构建中',
  statusType: 'running',
  message: '正在等待异步构建完成',
  refreshedAt: '',
})

// 启动页支持从 URL hash 读取（如 #dii-sqls 直接打开 SQL 分析页），方便本地 mock 演示
const currentPage = ref(
  (typeof window !== 'undefined' && window.location.hash?.slice(1)) || 'chain',
)
const mobileNavigationOpen = ref(false)
const impactMode = ref('table')
const impactSelectedId = ref(null)
const impactResult = ref(null)
const impactStats = ref({
  tableCount: 0,
  componentCount: 0,
  serviceCount: 0,
  componentBreakdown: {},
  serviceBreakdown: {},
})
const impactTableCatalog = ref([])
const impactTableCatalogLoaded = ref(false)
const impactTableCatalogLoading = ref(false)
const impactComponentCatalog = ref([])
const impactComponentCatalogLoaded = ref(false)
const impactComponentCatalogLoading = ref(false)
const impactServiceCatalog = ref([])
const impactServiceCatalogLoaded = ref(false)
const impactServiceCatalogLoading = ref(false)
let impactTableCatalogLoadPromise = null
let impactComponentCatalogLoadPromise = null
let impactServiceCatalogLoadPromise = null
let impactRequestSeq = 0
const impactExportingCurrent = ref(false)
const impactExportingAll = ref(false)
const impactNotice = ref(null)
let impactNoticeTimer = null

const impactSourceTransactions = computed(() => {
  const real = sortedTransactions.value.filter((tx) => tx?.chain)
  if (!isImpactMockEnabled()) return real
  return [...getMockImpactTransactions(), ...real]
})

const impactAllItems = computed(() => {
  const txs = impactSourceTransactions.value
  const doms = domains.value
  if (impactMode.value === 'table') {
    return impactTableCatalogLoaded.value ? impactTableCatalog.value : getAllTables(txs, doms)
  }
  if (impactMode.value === 'component') {
    return impactComponentCatalogLoaded.value ? impactComponentCatalog.value : getAllComponents(txs, doms)
  }
  return impactServiceCatalogLoaded.value ? impactServiceCatalog.value : getAllServices(txs, doms)
})
const localSearch  = ref('')
const cardRefs     = reactive({})

// ── 全局精确搜索状态（顶部搜索框，仅按交易码精确匹配） ──
const globalResult    = ref(null)   // 找到的完整链路对象
const globalNotFound  = ref(false)  // 搜索过但未找到
const globalQuery     = ref('')     // 当前查询的交易码
let suppressDomainWatch = false     // 切换领域时禁止触发 loadFirstPage

// 分页：现在用"覆盖式"分页（不再无限滚动累积），每页 10 条
// 字段名 allTransactions 沿用旧名（避免大面积改动），但语义改为"当前页交易列表"
const allTransactions = ref([])  // 当前页的交易列表（切换页时整个替换）
const currentPageNum  = ref(1)   // 当前页码（1-based）
const totalCount      = ref(0)
const isLoading       = ref(false)
const loadError       = ref('')
const mainRef         = ref(null)
// 加载时序令牌：并发加载（切领域 / 搜索 / 翻页）时只让「最后一次」生效，旧响应到达后作废，
// 根治搜索竞态（原先「isLoading 就 return」会把后发的关键词查询整个丢弃）。
let loadSeq = 0
let searchTimer = null   // 搜索防抖计时器

// 总页数（向上取整；至少 1 页避免分页器消失）
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE))
)

// 卡片"全部展开 / 全部关闭"操作（只针对当前页）
// 调用 TransactionCard 暴露的 expand() / collapse() 方法
const expandAllCards = () => {
  Object.values(cardRefs).forEach(card => card?.expand?.())
}
const collapseAllCards = () => {
  Object.values(cardRefs).forEach(card => card?.collapse?.())
}

// ── 搜索关键词（领域内模糊搜索，只用 localSearch） ──
const activeKeyword = computed(() => localSearch.value.trim())

// 全局精确搜索结果覆盖领域列表；否则返回已分页加载列表
const sortedTransactions = computed(() =>
  globalResult.value ? [globalResult.value] : allTransactions.value
)

// ── 系统健康检查（同时更新统计数字） ──
let healthTimer = null
const checkHealth = async () => {
  const [statsResult, buildResult] = await Promise.allSettled([
    getSystemStats(),
    getBuildSyncStatus(),
  ])

  if (statsResult.status === 'fulfilled') {
    systemStats.value = statsResult.value
  } else {
    systemStats.value = {
      ...(systemStats.value || {}),
      status: 'error',
      statusText: '系统运行异常'
    }
  }

  if (buildResult.status === 'fulfilled') {
    buildSyncInfo.value = {
      project: 'axon-link-server',
      branch: 'Master',
      versionNo: '--',
      statusText: '构建中',
      statusType: 'running',
      message: '正在等待异步构建完成',
      refreshedAt: '',
      ...buildResult.value,
    }
  } else {
    buildSyncInfo.value = {
      project: 'axon-link-server',
      branch: 'Master',
      versionNo: '--',
      statusText: '构建中',
      statusType: 'running',
      message: '正在等待异步构建完成',
      refreshedAt: '',
    }
  }
}

/**
 * 领域名「展示」兜底：后端 getDomains() 偶发返回原始码（comm/DEPT/sett，无中文 longname）。
 * 仅用于展示——不动 d.name（line ~850 用 d.name 做匹配键，改了会断全局搜索跳转）。
 * 已是中文（含汉字）原样返回；已知码（含 -bcc 变体，大小写无关）→ 中文领域。
 */
function domainDisplayName(raw) {
  if (raw == null) return raw
  const s = String(raw)
  if (/[一-龥]/.test(s)) return s   // 后端已给中文 → 原样
  const code = s.toLowerCase().replace(/-bcc$/, '')
  const map = {
    comm: '公共领域', common: '公共领域', public: '公共领域',
    dept: '存款领域', deposit: '存款领域',
    loan: '贷款领域',
    sett: '结算领域', settle: '结算领域', settlement: '结算领域',
  }
  return map[code] || s
}

// ── 初始化：加载领域列表 ──
const initDomains = async () => {
  try {
    const data = await getDomains()
    // 给每个领域补 displayName（展示用），name 保持后端原值供匹配
    domains.value = (Array.isArray(data) ? data : [])
      .map(d => ({ ...d, displayName: domainDisplayName(d?.name) }))
    if (domains.value.length) activeDomain.value = domains.value[0]
  } catch (e) {
    loadError.value = '加载领域失败：' + (e.message || '请检查后端服务是否启动')
  }
  await checkHealth()
}

const loadImpactTableCatalog = async () => {
  if (impactTableCatalogLoaded.value) return
  if (impactTableCatalogLoadPromise) return impactTableCatalogLoadPromise
  impactTableCatalogLoading.value = true
  impactTableCatalogLoadPromise = (async () => {
    try {
      const data = await getNeo4jTableCatalog()
      const items = Array.isArray(data?.items) ? data.items : []
      impactTableCatalog.value = items.map((item) => ({
        id: item.id,
        name: item.longname || item.name || item.id,
        longname: item.longname || item.name || item.id,
        desc: item.projectName || '',
        domainId: item.domainKey || 'public',
        projectName: item.projectName || '',
        daoClassName: item.daoClassName || '',
        nodeType: 'table',
      }))
      impactTableCatalogLoaded.value = true
    } catch (error) {
      console.warn('[ImpactAnalysis] 加载全量表目录失败，回退到本地链路表集合', error)
    } finally {
      impactTableCatalogLoading.value = false
      impactTableCatalogLoadPromise = null
    }
  })()
  return impactTableCatalogLoadPromise
}

const loadImpactComponentCatalog = async () => {
  if (impactComponentCatalogLoaded.value) return
  if (impactComponentCatalogLoadPromise) return impactComponentCatalogLoadPromise
  impactComponentCatalogLoading.value = true
  impactComponentCatalogLoadPromise = (async () => {
    try {
      const data = await getFlowtranComponentCatalog()
      const items = Array.isArray(data?.items) ? data.items : []
      impactComponentCatalog.value = items.map((item) => ({
        id: item.id,
        name: item.longname || item.name || item.id,
        longname: item.longname || item.name || item.id,
        desc: item.serviceTypeId || '',
        domainId: item.domainKey || 'public',
        type: item.nodeKind || '',
        serviceTypeId: item.serviceTypeId || '',
        nodeType: 'component',
      }))
      impactComponentCatalogLoaded.value = true
    } catch (error) {
      console.warn('[ImpactAnalysis] 加载全量构件目录失败，回退到本地链路构件集合', error)
    } finally {
      impactComponentCatalogLoading.value = false
      impactComponentCatalogLoadPromise = null
    }
  })()
  return impactComponentCatalogLoadPromise
}

const loadImpactStats = async () => {
  try {
    const data = await getFlowtranImpactStats()
    impactStats.value = {
      tableCount: Number(data?.tableCount || 0),
      componentCount: Number(data?.componentCount || 0),
      serviceCount: Number(data?.serviceCount || 0),
      componentBreakdown: data?.componentBreakdown || {},
      serviceBreakdown: data?.serviceBreakdown || {},
    }
  } catch (error) {
    console.warn('[ImpactAnalysis] 加载影响分析统计失败，降级为 0', error)
    impactStats.value = {
      tableCount: 0,
      componentCount: 0,
      serviceCount: 0,
      componentBreakdown: {},
      serviceBreakdown: {},
    }
  }
}

const loadImpactServiceCatalog = async () => {
  if (impactServiceCatalogLoaded.value) return
  if (impactServiceCatalogLoadPromise) return impactServiceCatalogLoadPromise
  impactServiceCatalogLoading.value = true
  impactServiceCatalogLoadPromise = (async () => {
    try {
      const data = await getFlowtranServiceCatalog()
      const items = Array.isArray(data?.items) ? data.items : []
      impactServiceCatalog.value = items.map((item) => ({
        id: item.id,
        name: item.longname || item.name || item.id,
        longname: item.longname || item.name || item.id,
        desc: item.serviceTypeId || '',
        domainId: item.domainKey || 'public',
        type: item.nodeKind || '',
        serviceTypeId: item.serviceTypeId || '',
        nodeType: 'service',
      }))
      impactServiceCatalogLoaded.value = true
    } catch (error) {
      console.warn('[ImpactAnalysis] 加载全量服务目录失败，回退到本地链路服务集合', error)
    } finally {
      impactServiceCatalogLoading.value = false
      impactServiceCatalogLoadPromise = null
    }
  })()
  return impactServiceCatalogLoadPromise
}

// ── 重置并加载第一页（领域切换 / 关键字切换时调用） ──
const loadFirstPage = async () => {
  if (!activeDomain.value) return
  await loadPage(1)
}

// ── 加载指定页（覆盖式分页：替换当前页数据，不累积） ──
// 切页时所有 cardRefs 自动随 v-for 重建，新卡片默认 collapsed，达到"切换分页后展开状态切换成关闭"的需求
const loadPage = async (pageNum) => {
  if (!activeDomain.value) return
  // 本次加载领到一个递增序号；后续任何 loadPage 会把它顶掉。
  // 不再因「有加载在飞」而丢弃本次——那正是搜索关键词被吞、退化成搜首字符(全含 T)的根因。
  const seq = ++loadSeq
  const dk = activeDomain.value.id
  const kw = activeKeyword.value   // 快照本次关键词，避免富化期间被后续输入改动
  isLoading.value = true
  loadError.value = ''
  try {
    const { list, total } = await getTransactions(dk, pageNum, PAGE_SIZE, kw)
    if (seq !== loadSeq) return    // 已被更晚的加载取代 → 丢弃这份旧结果，别覆盖新数据
    // 并发加载每个交易的链路详情；保留顺序（Promise.all 按数组顺序返回）
    const enriched = await Promise.all(
      list.map(async (tx) => {
        const chain = await getChain(tx.id || tx.txCode)
        return chain ? { ...chain, domainKey: dk } : null
      }),
    )
    if (seq !== loadSeq) return    // 富化期间又被取代 → 丢弃
    totalCount.value = total
    // 覆盖式：直接替换数组，让旧卡片随 v-for 卸载，新卡片重新挂载（默认 collapsed）
    allTransactions.value = enriched.filter(Boolean)
    currentPageNum.value = pageNum
    // 滚回顶部，让用户看到第一条
    mainRef.value?.scrollTo({ top: 0 })
  } catch (e) {
    if (seq !== loadSeq) return
    loadError.value = '加载交易数据失败：' + (e.message || '请检查后端服务')
    allTransactions.value = []
    totalCount.value = 0
  } finally {
    if (seq === loadSeq) isLoading.value = false   // 只有最新那次负责收起 loading
  }
}

// 跳到指定页（分页器按钮调用）
const goToPage = (pageNum) => {
  if (pageNum < 1 || pageNum > totalPages.value || pageNum === currentPageNum.value || isLoading.value) return
  loadPage(pageNum)
}

// 分页器数字：当前页 ±2 + 首尾 + 省略号；总页数 ≤7 全显
const pagerNumbers = computed(() => {
  const tp = totalPages.value
  const cur = currentPageNum.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const arr = [1]
  if (cur > 4) arr.push('...')
  for (let p = Math.max(2, cur - 2); p <= Math.min(tp - 1, cur + 2); p++) arr.push(p)
  if (cur < tp - 3) arr.push('...')
  arr.push(tp)
  return arr
})

// ── 监听领域/本地搜索词变化 ──
watch(activeDomain, () => {
  if (suppressDomainWatch) return
  // 切换领域时清除全局搜索状态
  globalResult.value   = null
  globalNotFound.value = false
  globalQuery.value    = ''
  loadFirstPage()
})
// 防抖：停止输入 300ms 才查一次，避免每敲一个字就发一次（原先每键一查 + 加载丢弃 = 只跑了首字符查询）
watch(localSearch, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadFirstPage, 300)
})

// 改为分页后，不再需要"底部哨兵 + 滚动加载更多"的 IntersectionObserver
// 也不再需要"卡片入屏自动展开"的 cardObserver——因为：
//   1) 每页固定 10 条，不会有大量卡片渲染压力
//   2) 用户要求默认全部 collapsed，避免自动展开干扰

onMounted(async () => {
  applyTheme(isDark.value)
  await initDomains()
  void Promise.all([loadImpactTableCatalog(), loadImpactStats()])
  healthTimer = setInterval(checkHealth, 30_000)
})
onBeforeUnmount(() => {
  dismissImpactNotice()
  clearInterval(healthTimer)
  clearTimeout(searchTimer)
})

const selectDomain = (domain) => {
  globalResult.value   = null
  globalNotFound.value = false
  globalQuery.value    = ''
  activeDomain.value   = domain
  localSearch.value    = ''
}

const onSelectDomainNav = (domain) => {
  currentPage.value = 'chain'
  selectDomain(domain)
}

// ══════════ SQL 巡检侧边栏点击处理 ══════════
const onSelectDiiPage = (pageKey) => {
  // pageKey ∈ diiMenu 的 key（dii-dashboard / dii-sqls(AI-SQL分析) / dii-slow-sql / dii-sql-whitelist / dii-tasks / dii-er）
  currentPage.value = pageKey
}

const onSelectReplayPage = (pageKey) => {
  currentPage.value = pageKey
  mobileNavigationOpen.value = false
}

// ══════════ 代码提交（独立分区）侧边栏点击 ══════════
const onSelectCodePage = () => {
  currentPage.value = 'code-dashboard'
}

const onSelectImpactMode = async (mode) => {
  impactMode.value = mode
  impactSelectedId.value = null
  impactResult.value = null
  const switchId = ++impactRequestSeq
  currentPage.value = 'impact'

  if (mode === 'table') {
    await loadImpactTableCatalog()
  } else if (mode === 'component') {
    await loadImpactComponentCatalog()
  } else if (mode === 'service') {
    await loadImpactServiceCatalog()
  }

  if (switchId !== impactRequestSeq || impactMode.value !== mode) return
  await nextTick()
  if (switchId !== impactRequestSeq || impactMode.value !== mode) return

  const items = impactAllItems.value
  if (items.length > 0) {
    await onImpactSelectItem(items[0].id)
  }
}

const buildEmptyTableImpactResult = (item) => item ? {
  mode: 'table',
  root: {
    id: item.id,
    name: item.name || item.id,
    desc: item.desc || '',
    domainId: item.domainId || 'public',
    nodeType: 'table',
  },
  levels: [[], [], []],
  edges: [],
  stats: {
    components: 0,
    services: 0,
    transactions: 0,
  },
} : null

const buildEmptyComponentImpactResult = (item) => item ? {
  mode: 'component',
  root: {
    id: item.id,
    name: item.name || item.id,
    desc: item.desc || '',
    domainId: item.domainId || 'public',
    type: item.type || '',
    nodeType: 'component',
  },
  levels: [[], []],
  edges: [],
  stats: {
    services: 0,
    transactions: 0,
  },
} : null

const buildEmptyServiceImpactResult = (item) => item ? {
  mode: 'service',
  root: {
    id: item.id,
    name: item.name || item.id,
    desc: item.desc || '',
    domainId: item.domainId || 'public',
    type: item.type || '',
    nodeType: 'service',
  },
  levels: [[], [], []],
  edges: [],
  stats: {
    services: 0,
    upstreamServices: 0,
    orchestrations: 0,
    transactions: 0,
  },
} : null

const onImpactSelectItem = async (id) => {
  if (id === impactSelectedId.value) return
  impactSelectedId.value = id
  const requestId = ++impactRequestSeq

  const item = impactAllItems.value.find((entry) => entry.id === id)
  impactResult.value = impactMode.value === 'table'
    ? buildEmptyTableImpactResult(item)
    : impactMode.value === 'component'
      ? buildEmptyComponentImpactResult(item)
      : buildEmptyServiceImpactResult(item)

  try {
    const result = impactMode.value === 'table'
      ? await getFlowtranTableImpact(id)
      : impactMode.value === 'component'
        ? await getFlowtranComponentImpact(id)
        : await getFlowtranServiceImpact(id)
    if (requestId !== impactRequestSeq) return
    impactResult.value = result || (
      impactMode.value === 'table'
        ? buildEmptyTableImpactResult(item)
        : impactMode.value === 'component'
          ? buildEmptyComponentImpactResult(item)
          : buildEmptyServiceImpactResult(item)
    )
  } catch (error) {
    if (requestId !== impactRequestSeq) return
    const modeLabel = impactMode.value === 'table'
      ? '表级'
      : impactMode.value === 'component'
        ? '构件'
        : '服务'
    console.warn(`[ImpactAnalysis] 加载${modeLabel}影响分析失败，显示空图`, error)
    impactResult.value = impactMode.value === 'table'
      ? buildEmptyTableImpactResult(item)
      : impactMode.value === 'component'
        ? buildEmptyComponentImpactResult(item)
        : buildEmptyServiceImpactResult(item)
  }

  if (requestId !== impactRequestSeq) {
    return
  }
}

const onExportImpactCurrent = async () => {
  if (!impactSelectedId.value || impactExportingCurrent.value) return
  impactExportingCurrent.value = true
  try {
    await exportFlowtranImpactCurrent(impactMode.value, impactSelectedId.value)
  } catch (error) {
    console.warn('[ImpactAnalysis] 导出当前 Excel 失败', error)
    showImpactNotice('error', '导出失败', error?.message || '导出当前 Excel 失败，请稍后重试')
  } finally {
    impactExportingCurrent.value = false
  }
}

const onExportImpactAll = async () => {
  if (impactAllItems.value.length === 0 || impactExportingAll.value) return
  impactExportingAll.value = true
  try {
    await exportFlowtranImpactAll(impactMode.value)
  } catch (error) {
    console.warn('[ImpactAnalysis] 导出全部 Excel 失败', error)
    const message = error?.message || '导出全部 Excel 失败，请稍后重试'
    if (message.includes('后台制作中')) {
      showImpactNotice('info', '全量导出准备中', '后台制作中，稍后重试')
    } else {
      showImpactNotice('error', '导出失败', message)
    }
  } finally {
    impactExportingAll.value = false
  }
}

const showImpactNotice = (type, title, message, duration = 3600) => {
  if (impactNoticeTimer) {
    clearTimeout(impactNoticeTimer)
    impactNoticeTimer = null
  }
  impactNotice.value = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    title,
    message,
  }
  impactNoticeTimer = window.setTimeout(() => {
    impactNotice.value = null
    impactNoticeTimer = null
  }, duration)
}

const dismissImpactNotice = () => {
  if (impactNoticeTimer) {
    clearTimeout(impactNoticeTimer)
    impactNoticeTimer = null
  }
  impactNotice.value = null
}

// ── 全局精确搜索：按交易码精确匹配，跨领域查找 ──
const handleGlobalSearch = async (code) => {
  // 清除：恢复当前领域正常视图
  if (!code) {
    globalResult.value   = null
    globalNotFound.value = false
    globalQuery.value    = ''
    appHeaderRef.value?.setResult(true)
    return
  }

  globalQuery.value    = code.trim().toUpperCase()
  globalResult.value   = null
  globalNotFound.value = false

  try {
    const chain = await getChain(globalQuery.value)
    // 找到：切换到对应领域（静默，不触发 loadFirstPage）
    const targetDomain = domains.value.find(d => d.name === chain.domain)
    if (targetDomain && targetDomain.id !== activeDomain.value?.id) {
      suppressDomainWatch = true
      activeDomain.value  = targetDomain
      await nextTick()
      suppressDomainWatch = false
    }
    globalResult.value = { ...chain, domainKey: targetDomain?.id || activeDomain.value?.id }
    appHeaderRef.value?.setResult(true)
  } catch {
    globalNotFound.value = true
    appHeaderRef.value?.setResult(false)
  }
}

const expandAll   = () => sortedTransactions.value.forEach(tx => cardRefs[tx.id]?.expand())
const collapseAll = () => sortedTransactions.value.forEach(tx => cardRefs[tx.id]?.collapse())

// 全量下载：若当前已选领域则带 domain，否则导全部
// 注：本组件用 activeDomain（{ id, name }）表示当前领域，domain 参数取其 id（领域 key）
async function downloadAllErrorCodes() {
  await exportAllErrorCodes(activeDomain.value?.id || undefined)
}
</script>

<style scoped>
.page-layout {
  height: 100vh;
  background: var(--bg-page);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background 0.3s;
}

.page-body {
  display: flex;
  flex: 1;
  margin-top: 56px;
  height: calc(100vh - 56px);
  overflow: hidden;
}

.main-content,
.impact-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.replay-mobile-backdrop { display: none; }

/* ── 固定头部 ── */
.sticky-header {
  flex-shrink: 0;
  background: var(--bg-sticky);
  padding: 24px 24px 0;
  z-index: 10;
  transition: background 0.3s;
}

/* 顶部工具条 */
.header-topbar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

/* ── 卡片滚动区 ── */
.cards-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 24px 24px;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

.cards-scroll::-webkit-scrollbar { width: 6px; }
.cards-scroll::-webkit-scrollbar-track { background: transparent; }
.cards-scroll::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
.cards-scroll::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }

/* 面包屑 */
.breadcrumb { display: flex; align-items: center; gap: 6px; min-width: 0; }
.breadcrumb-home { font-size: 13px; color: var(--text-faint); cursor: pointer; transition: color 0.15s; }
.breadcrumb-home:hover { color: #4F7CFF; }
.breadcrumb-current { font-size: 13px; color: var(--text-primary); font-weight: 500; }

.build-sync-label {
  font-size: 11px;
  color: var(--text-faint);
  letter-spacing: 0.04em;
}

.build-sync-value {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.build-sync-version {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--build-sync-version-border);
  background: var(--build-sync-version-bg);
  color: var(--build-sync-version-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.45;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.build-sync-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-width: 64px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  border: 1px solid var(--build-sync-pill-border);
  background: var(--build-sync-idle-bg);
  color: var(--build-sync-idle-color);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.build-sync-inline {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  margin-left: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--build-sync-border);
  background: var(--build-sync-bg);
  box-shadow: var(--build-sync-shadow);
  backdrop-filter: blur(8px);
  transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}

.build-sync-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.build-sync-meta + .build-sync-meta {
  position: relative;
  padding-left: 14px;
}

.build-sync-meta + .build-sync-meta::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 1px;
  height: 18px;
  background: var(--build-sync-divider);
  transform: translateY(-50%);
}

.build-sync-version-wrap {
  max-width: 240px;
}

.build-sync-version-wrap .build-sync-version {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.build-sync-inline.is-success .build-sync-status-pill {
  background: var(--build-sync-success-bg);
  color: var(--build-sync-success-color);
  border-color: var(--build-sync-success-border);
}

.build-sync-inline.is-running .build-sync-status-pill {
  background: var(--build-sync-running-bg);
  color: var(--build-sync-running-color);
  border-color: var(--build-sync-running-border);
}

.build-sync-inline.is-error .build-sync-status-pill {
  background: var(--build-sync-error-bg);
  color: var(--build-sync-error-color);
  border-color: var(--build-sync-error-border);
}

.build-sync-inline.is-unknown .build-sync-status-pill,
.build-sync-inline.is-idle .build-sync-status-pill {
  background: var(--build-sync-idle-bg);
  color: var(--build-sync-idle-color);
  border-color: var(--build-sync-idle-border);
}

/* 标题栏 */
.content-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 16px; }
.content-title-group { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; flex-wrap: wrap; }
.content-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; white-space: nowrap; }
.tx-count-badge { font-size: 12px; color: var(--text-muted); background: var(--bg-badge); padding: 3px 10px; border-radius: 12px; font-weight: 500; }
.content-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.domain-search { display: flex; align-items: center; gap: 8px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 0 12px; height: 34px; transition: border-color 0.2s, box-shadow 0.2s; }
.domain-search:focus-within { border-color: #4F7CFF; box-shadow: 0 0 0 3px rgba(79,124,255,0.1); }
.domain-search-input { border: none; outline: none; font-size: 13px; color: var(--text-secondary); background: transparent; width: 180px; }
.domain-search-input::placeholder { color: var(--text-faint); }

.action-btn { display: flex; align-items: center; gap: 5px; padding: 0 12px; height: 34px; background: var(--bg-action-btn); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; color: var(--text-secondary); cursor: pointer; font-weight: 500; font-family: inherit; transition: all 0.15s; white-space: nowrap; }
.action-btn:hover { background: #EEF3FF; border-color: #C5D5FF; color: #4F7CFF; }

/* 统计栏 */
.stats-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg-stats-bar); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px; transition: background 0.3s; }
.stats-text { font-size: 13px; color: var(--text-secondary); font-weight: 500; flex: 1; }
.search-hint { font-size: 12px; color: var(--text-faint); }
.search-hint em { font-style: normal; color: #4F7CFF; font-weight: 500; }

/* 全部展开 / 全部关闭按钮：放在 stats-bar 右侧，仅作用于当前页 */
.bulk-toggle { display: flex; gap: 6px; }
.bulk-btn {
  padding: 4px 10px;
  font-size: 12px;
  background: var(--bg-card, #fff);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.bulk-btn:hover:not(:disabled) {
  background: var(--bg-domain-hover, #f5f7fa);
  color: var(--text-primary);
}
.bulk-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 分页器 */
.pager {
  display: flex;
  gap: 4px;
  align-items: center;
  margin: 16px 0 24px;
  justify-content: center;
  flex-wrap: wrap;
}
.pager-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: background 0.15s, color 0.15s;
}
.pager-btn:hover:not(:disabled):not(.pager-active) {
  background: var(--bg-domain-hover, #f5f7fa);
  color: var(--text-primary);
}
.pager-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pager-active {
  background: #4F7CFF !important;
  color: #fff !important;
  border-color: #4F7CFF;
}
.pager-info {
  margin-left: 12px;
  font-size: 12.5px;
  color: var(--text-faint);
}

/* 列表 */
.transaction-list { display: flex; flex-direction: column; gap: 10px; }

/* 哨兵 & 加载状态 */
.sentinel { padding: 20px 0 40px; display: flex; justify-content: center; }

.loading-more {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-faint);
}

@keyframes spin { to { transform: rotate(360deg); } }
.loading-spin { animation: spin 0.8s linear infinite; }

.load-hint { font-size: 12px; color: var(--text-faint); }

.all-loaded {
  font-size: 12px;
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 8px;
}

.all-loaded::before,
.all-loaded::after {
  content: '';
  flex: 1;
  max-width: 60px;
  height: 1px;
  background: var(--border);
}

/* 错误状态 */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  background: var(--bg-card);
  border: 1px dashed #FFCCC7;
  border-radius: 10px;
}
.error-state p { font-size: 13px; color: #FF4D4F; margin: 0; }

/* 空状态 */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; gap: 12px; background: var(--bg-empty); border: 1px dashed var(--border-dashed); border-radius: 10px; }
.empty-state p { font-size: 15px; color: var(--text-primary); font-weight: 500; margin: 0; }
.empty-state span { font-size: 13px; color: var(--text-muted); }

@media (max-width: 1280px) {
  .content-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .content-actions {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .page-body :deep(.cis) {
    position: fixed;
    z-index: 25;
    top: 56px;
    bottom: 0;
    left: 0;
    transform: translateX(-100%);
    transition: transform .2s ease;
  }

  .page-body :deep(.cis.is-mobile-open) { transform: translateX(0); }

  .replay-mobile-backdrop {
    position: fixed;
    z-index: 24;
    inset: 56px 0 0;
    display: block;
    border: 0;
    background: rgba(13, 20, 36, .42);
  }

  .build-sync-inline {
    width: 100%;
    margin-left: 0;
    justify-content: space-between;
    border-radius: 14px;
    padding: 10px 12px;
  }

  .build-sync-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .build-sync-meta + .build-sync-meta {
    padding-left: 0;
  }

  .build-sync-meta + .build-sync-meta::before {
    display: none;
  }

  .build-sync-version-wrap {
    max-width: 160px;
  }

  .content-actions {
    flex-wrap: wrap;
  }
}
</style>
