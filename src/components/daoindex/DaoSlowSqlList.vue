<template>
  <div class="slow-wrap">
    <!-- 顶部工具条 -->
    <div class="slow-toolbar">
      <div class="slow-tb-left">
        <input v-model="keyword" class="slow-input" placeholder="搜索 抽象SQL / 微服务 / 来源文件" @keyup.enter="reload" />
        <!-- v2：轮次下拉（默认最新一轮；空=全部轮次跨轮对比） -->
        <select v-model="roundSel" class="slow-select" @change="page = 0; reload()">
          <option value="">全部轮次</option>
          <option v-for="r in roundsDesc" :key="r" :value="r">{{ r }}</option>
        </select>
        <select v-model="domain" class="slow-select" @change="reload">
          <option value="">全部领域</option>
          <option v-for="d in domains" :key="d" :value="d">{{ d }}</option>
        </select>
        <select v-model="bizType" class="slow-select" @change="reload">
          <option value="">全部类型</option>
          <option v-for="t in bizTypes" :key="t" :value="t">{{ t }}</option>
        </select>
        <select v-model="whitelistStatus" class="slow-select" @change="reload">
          <option value="">全部白名单状态</option>
          <option value="NONE">未申请</option>
          <option value="PENDING_L1">待一级</option>
          <option value="PENDING_L2">待二级</option>
          <option value="APPROVED">已通过</option>
          <option value="REJECTED_L1">已退回</option>
        </select>
        <button class="slow-btn" @click="reload">查询</button>
      </div>
      <div class="slow-tb-right">
        <button class="slow-btn" @click="openImport">导入 Excel/CSV</button>
        <button class="slow-btn" @click="doExport">导出 Excel</button>
      </div>
    </div>

    <div v-if="filter?.myApprovalTodo" class="slow-todo-banner">
      🔔 仅显示「该我审批」的慢SQL（待一级 / 待二级）
      <button class="slow-link" @click="clearTodo">清除筛选</button>
    </div>
    <div class="slow-kpi">共 <b>{{ total }}</b> 条抽象SQL</div>

    <!-- 列表 -->
    <div v-if="loading" class="slow-state">加载中…</div>
    <div v-else-if="errorMsg" class="slow-state slow-err">{{ errorMsg }}</div>
    <div v-else-if="items.length === 0" class="slow-state">暂无数据，请先「导入 Excel/CSV」。</div>
    <table v-else class="slow-table">
      <thead>
        <tr>
          <th>微服务</th><th>领域</th><th>类型</th><th>抽象SQL</th><th class="num">最大执行耗时</th>
          <th>执行参数</th><th class="num">执行次数</th><th>来源文件</th><th>轮次</th><th>重复出现轮次</th><th>白名单</th><th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="it in items" :key="it.id">
          <td class="svc-cell" :title="it.service_name">{{ it.service_name }}</td>
          <td>{{ it.domain }}</td>
          <td>{{ it.biz_type }}</td>
          <td class="sql-cell" :title="it.abstract_sql">{{ it.abstract_sql }}</td>
          <td class="num" :title="it.max_time_cost_raw">{{ it.max_time_cost_ms }}ms</td>
          <td class="param-cell" :title="it.exec_params">{{ it.exec_params }}</td>
          <td class="num">{{ it.exec_count }}</td>
          <td class="loc-cell" :title="it.source_location">{{ it.source_location }}</td>
          <td>{{ it.round }}</td>
          <td class="rounds-cell" :title="it.repeat_rounds">{{ it.repeat_rounds || '—' }}</td>
          <td><span class="wl-tag" :class="wlClass(it.whitelist_status)">{{ wlLabel(it.whitelist_status) }}</span></td>
          <td>
            <button v-if="!it.whitelist_status" class="slow-link" @click="openApply(it)">申请白名单</button>
            <button v-else class="slow-link" @click="openView(it)">查看/审批</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 分页 -->
    <div class="slow-pager" v-if="total > pageSize">
      <button class="slow-btn" :disabled="page === 0" @click="page--; reload()">上一页</button>
      <span>{{ page + 1 }} / {{ Math.ceil(total / pageSize) }}</span>
      <button class="slow-btn" :disabled="(page + 1) * pageSize >= total" @click="page++; reload()">下一页</button>
    </div>

    <!-- 导入弹窗 -->
    <div v-if="importOpen" class="slow-modal-mask" @click.self="importOpen = false">
      <div class="slow-modal">
        <h3>导入慢SQL明细</h3>
        <p class="slow-hint">5 列：微服务 / 抽象SQL / 执行参数 / 执行耗时 / 来源文件；首行表头自动跳过。
          导入时按 (微服务+抽象SQL) 聚合：取最大耗时代表行并统计执行次数；同轮次重复导入会覆盖。</p>
        <input type="file" accept=".xlsx,.xls,.csv" @change="onFile" />
        <input v-model="importRound" class="slow-input full" maxlength="20"
               placeholder="轮次（必填，如 20260103-20260107）" />
        <input v-model="token" class="slow-input full" type="password" placeholder="导入口令 X-DII-Trigger-Token" />
        <p v-if="importMsg" class="slow-hint">{{ importMsg }}</p>
        <div class="slow-modal-foot">
          <button class="slow-btn" @click="importOpen = false">取消</button>
          <button class="slow-btn primary" :disabled="!importFileRef || !importRound.trim() || importing" @click="doImport">{{ importing ? '导入中…' : '导入' }}</button>
        </div>
      </div>
    </div>

    <!-- 申请弹窗 -->
    <div v-if="applyOpen" class="slow-modal-mask" @click.self="applyOpen = false">
      <div class="slow-modal">
        <h3>申请白名单（慢SQL）</h3>
        <div class="slow-sql-snip">{{ applyRow?.abstract_sql }}</div>
        <select v-model="applyL1" class="slow-input full">
          <option value="">选择一级审批人</option>
          <option v-for="a in l1Approvers" :key="a.username" :value="a.username">{{ a.name || a.username }}</option>
        </select>
        <textarea v-model="applyReason" class="slow-input full" placeholder="申请理由" rows="3"></textarea>
        <p v-if="applyMsg" class="slow-hint">{{ applyMsg }}</p>
        <div class="slow-modal-foot">
          <button class="slow-btn" @click="applyOpen = false">取消</button>
          <button class="slow-btn primary" :disabled="!applyL1 || applying" @click="doApply">{{ applying ? '提交中…' : '提交申请' }}</button>
        </div>
      </div>
    </div>

    <!-- 查看/审批弹窗 -->
    <div v-if="viewOpen" class="slow-modal-mask" @click.self="viewOpen = false">
      <div class="slow-modal">
        <h3>白名单申请 #{{ viewApp?.id }}</h3>
        <div class="slow-kv">状态：<b>{{ wlLabel(viewApp?.status) }}</b></div>
        <div class="slow-kv">申请人：{{ viewApp?.applicant }}　一级：{{ viewApp?.l1_approver }}　二级：{{ viewApp?.l2_approver || '-' }}</div>
        <div class="slow-sql-snip">{{ viewApp?.sql_text }}</div>
        <textarea v-if="viewMode" v-model="viewOpinion" class="slow-input full" placeholder="审批意见" rows="2"></textarea>
        <select v-if="viewMode === 'l1'" v-model="viewL2" class="slow-input full">
          <option value="">通过时选择二级审批人</option>
          <option v-for="a in l2Approvers" :key="a.username" :value="a.username">{{ a.name || a.username }}</option>
        </select>
        <p v-if="viewMsg" class="slow-hint">{{ viewMsg }}</p>
        <div class="slow-modal-foot">
          <button class="slow-btn" @click="viewOpen = false">关闭</button>
          <template v-if="viewMode === 'l1'">
            <button class="slow-btn" @click="act('l1Reject')">退回</button>
            <button class="slow-btn primary" :disabled="!viewL2" @click="act('l1Approve')">一级通过</button>
          </template>
          <template v-else-if="viewMode === 'l2'">
            <button class="slow-btn" @click="act('l2Reject')">退回</button>
            <button class="slow-btn primary" @click="act('l2Approve')">二级通过</button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  listSlowSql, listSlowSqlDomains, listSlowSqlBizTypes, listSlowSqlRounds,
  importSlowSql, exportSlowSql,
  getWhitelistApprovers, applyWhitelist, getWhitelistApplication,
  l1Approve, l1Reject, l2Approve, l2Reject,
} from '../../api/daoIndex.js'
import { getCurrentUser } from '../../api/auth.js'

const props = defineProps({
  env: { type: String, default: 'uat' },
  filter: { type: Object, default: () => ({}) },   // { myApprovalTodo } —— 铃铛慢SQL待办跳来
})
const emit = defineEmits(['update:env', 'clear-todo-filter'])

const items = ref([]); const total = ref(0); const loading = ref(false); const errorMsg = ref('')
const keyword = ref(''); const domain = ref(''); const bizType = ref(''); const whitelistStatus = ref('')
const domains = ref([]); const bizTypes = ref([]); const page = ref(0); const pageSize = 50
// v2：轮次（后端升序返回；下拉倒序展示，默认选最新一轮）
const rounds = ref([]); const roundSel = ref('')
const roundsDesc = computed(() => rounds.value.slice().reverse())

const currentUser = ref('')
const l1Approvers = ref([]); const l2Approvers = ref([])

async function reload() {
  loading.value = true; errorMsg.value = ''
  try {
    const data = await listSlowSql({
      keyword: keyword.value, domain: domain.value, bizType: bizType.value,
      whitelistStatus: whitelistStatus.value,
      round: roundSel.value || undefined,   // v2：按轮次过滤（空=全部轮次）
      // 铃铛「慢SQL待办」跳来：只看该我审批的待审慢SQL
      approverUser: props.filter?.myApprovalTodo ? (currentUser.value || undefined) : undefined,
      limit: pageSize, offset: page.value * pageSize,
    })
    items.value = data.items || []; total.value = data.total || 0
  } catch (e) {
    errorMsg.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}
// 清除「我的待审」过滤（通知父级重置 filter）
function clearTodo() { emit('clear-todo-filter') }
// filter 变化（铃铛跳来 / 清除）→ 重新加载（组件 v-show 常驻不会重挂载）
watch(() => props.filter, () => { page.value = 0; reload() }, { deep: true })

onMounted(async () => {
  try { domains.value = await listSlowSqlDomains() } catch { /* ignore */ }
  try { bizTypes.value = await listSlowSqlBizTypes() } catch { /* ignore */ }
  // v2：拉轮次列表（后端升序），默认选最新一轮（末位）
  try {
    rounds.value = await listSlowSqlRounds()
    if (rounds.value.length > 0) roundSel.value = rounds.value[rounds.value.length - 1]
  } catch { /* ignore */ }
  try { const u = await getCurrentUser(); if (u?.username) currentUser.value = u.username } catch { /* ignore */ }
  try {
    const ap = await getWhitelistApprovers()
    l1Approvers.value = ap.l1Approvers || []; l2Approvers.value = ap.l2Approvers || []
  } catch { /* ignore */ }
  reload()
})

/* ── 导入 ── */
const importOpen = ref(false); const token = ref(''); const importing = ref(false); const importMsg = ref('')
const importFileRef = ref(null)
// v2：轮次由用户输入（如 20260103-20260107），同轮重复导入=覆盖
const importRound = ref('')
// 打开导入弹窗时清掉上一次的文件/提示，保证重复导入同名文件也能再次触发 @change
function openImport() { importFileRef.value = null; importMsg.value = ''; importOpen.value = true }
function onFile(e) { importFileRef.value = e.target.files?.[0] || null }
async function doImport() {
  if (!importFileRef.value || !importRound.value.trim()) return
  importing.value = true; importMsg.value = ''
  try {
    const r = await importSlowSql(importFileRef.value, props.env, token.value, importRound.value.trim())
    importMsg.value = `轮次 ${r.round}：原始 ${r.rawRows} 行 → 聚合 ${r.aggregatedRows} 条`
      + `（${r.repeatHit} 条曾在历史轮次出现，跳过 ${r.skipped}${r.overwritten ? `，覆盖旧轮 ${r.overwritten} 条` : ''}）`
    page.value = 0
    domains.value = await listSlowSqlDomains()
    bizTypes.value = await listSlowSqlBizTypes()
    // 刷新轮次下拉并切到刚导入的轮次
    try { rounds.value = await listSlowSqlRounds() } catch { /* ignore */ }
    roundSel.value = r.round
    await reload()
  } catch (e) {
    importMsg.value = e.code === 'TOKEN_INVALID' ? '口令错误' : `导入失败：${e?.message || e}`
  } finally {
    importing.value = false
  }
}

/* ── 导出 ── */
async function doExport() {
  try { await exportSlowSql(props.env) } catch (e) { alert(`导出失败：${e?.message || e}`) }
}

/* ── 申请 ── */
const applyOpen = ref(false); const applyRow = ref(null); const applyL1 = ref(''); const applyReason = ref(''); const applying = ref(false); const applyMsg = ref('')
function openApply(it) { applyRow.value = it; applyL1.value = ''; applyReason.value = ''; applyMsg.value = ''; applyOpen.value = true }
async function doApply() {
  applying.value = true; applyMsg.value = ''
  try {
    await applyWhitelist({
      slowSql: true,
      sqlHash: applyRow.value.abstract_hash,
      sqlText: applyRow.value.abstract_sql,
      kindSource: 'slow',
      env: props.env,
      applyReason: applyReason.value,
      l1Approver: applyL1.value,
      sourceTable: 'slow_sql',
      sourceId: applyRow.value.id,
      applicant: currentUser.value,
    })
    applyOpen.value = false
    await reload()
  } catch (e) {
    applyMsg.value = `申请失败：${e?.message || e}`
  } finally {
    applying.value = false
  }
}

/* ── 查看/审批 ── */
const viewOpen = ref(false); const viewApp = ref(null); const viewMode = ref(''); const viewOpinion = ref(''); const viewL2 = ref(''); const viewMsg = ref('')
async function openView(it) {
  viewMsg.value = ''; viewOpinion.value = ''; viewL2.value = ''
  try {
    const app = await getWhitelistApplication(it.whitelist_app_id)
    viewApp.value = app
    const u = currentUser.value
    if (app?.status === 'PENDING_L1' && app?.l1_approver === u) viewMode.value = 'l1'
    else if (app?.status === 'PENDING_L2' && app?.l2_approver === u) viewMode.value = 'l2'
    else viewMode.value = ''
    viewOpen.value = true
  } catch (e) {
    alert(`加载失败：${e?.message || e}`)
  }
}
async function act(kind) {
  viewMsg.value = ''
  try {
    const id = viewApp.value.id
    if (kind === 'l1Approve') await l1Approve(id, { opinion: viewOpinion.value, l2Approver: viewL2.value, currentUser: currentUser.value })
    else if (kind === 'l1Reject') await l1Reject(id, { opinion: viewOpinion.value, currentUser: currentUser.value })
    else if (kind === 'l2Approve') await l2Approve(id, { opinion: viewOpinion.value, currentUser: currentUser.value })
    else if (kind === 'l2Reject') await l2Reject(id, { opinion: viewOpinion.value, currentUser: currentUser.value })
    viewOpen.value = false
    await reload()
  } catch (e) {
    viewMsg.value = `操作失败：${e?.message || e}`
  }
}

/* ── 文案 ── */
function wlLabel(s) {
  return ({ PENDING_L1: '待一级', PENDING_L2: '待二级', APPROVED: '已通过', REJECTED_L1: '已退回', CANCELLED: '已取消' })[s] || '未申请'
}
function wlClass(s) {
  if (s === 'APPROVED') return 'ok'
  if (s === 'REJECTED_L1') return 'bad'
  if (s === 'PENDING_L1' || s === 'PENDING_L2') return 'pending'
  return ''
}
</script>

<style scoped>
/* ── design tokens（仅 token，不含 layout；补齐全局未定义的 panel/status/brand，亮暗分离）── */
.slow-wrap {
  --slow-panel: #ffffff;
  --slow-brand: #0b70db;   --slow-on-brand: #ffffff;
  --slow-ok: #137333;      --slow-ok-bg: #e6f4ea;
  --slow-bad: #cf1124;     --slow-bad-bg: #fce8e6;
  --slow-warn: #c08c00;    --slow-warn-bg: #fef7e0;
}
[data-theme="dark"] .slow-wrap {
  --slow-panel: #1b2129;
  --slow-brand: #4493f8;   --slow-on-brand: #ffffff;
  --slow-ok: #6ec78a;      --slow-ok-bg: #1e3a28;
  --slow-bad: #ff7a7e;     --slow-bad-bg: #3a1f21;
  --slow-warn: #f5c062;    --slow-warn-bg: #3a3320;
}

.slow-wrap { padding: 16px; color: var(--text-primary, #14171c); }
.slow-toolbar { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.slow-tb-left, .slow-tb-right { display: flex; gap: 8px; flex-wrap: wrap; }
.slow-input, .slow-select {
  padding: 6px 10px; border: 1px solid var(--border, #d4d8dd);
  background: var(--bg-input, #fff); color: var(--text-primary, #14171c); border-radius: 6px; font-size: 13px;
}
.slow-input.full { width: 100%; margin-top: 8px; }
.slow-btn {
  padding: 6px 12px; border: 1px solid var(--border, #d4d8dd);
  background: var(--bg-domain-hover, #f5f7fa); color: var(--text-primary, #14171c);
  border-radius: 6px; cursor: pointer; font-size: 13px;
}
.slow-btn:hover { background: var(--bg-domain-active, #eef1f5); }
.slow-btn.primary { background: var(--slow-brand); color: var(--slow-on-brand); border-color: transparent; }
.slow-btn:disabled { opacity: .5; cursor: not-allowed; }
.slow-kpi { margin: 12px 0; font-size: 13px; color: var(--text-secondary, #5a6172); }
.slow-todo-banner { margin: 12px 0 0; padding: 8px 12px; border-radius: 6px; font-size: 13px;
  background: var(--slow-warn-bg); color: var(--slow-warn); display: flex; justify-content: space-between; align-items: center; }
.slow-state { padding: 40px; text-align: center; color: var(--text-secondary, #5a6172); }
.slow-err { color: var(--slow-bad); }
.slow-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.slow-table th, .slow-table td {
  border-bottom: 1px solid var(--border-subtle, #ebeef2); padding: 8px 10px; text-align: left; vertical-align: top;
}
.slow-table th { color: var(--text-secondary, #5a6172); font-weight: 600; }
.slow-table .num { text-align: right; white-space: nowrap; }
.sql-cell { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
.param-cell { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary, #5a6172); }
/* v2：微服务 / 来源文件 / 重复出现轮次 截断单元格 */
.svc-cell { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.loc-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; font-size: 12px; color: var(--text-secondary, #5a6172); }
.rounds-cell { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary, #5a6172); }
.slow-link { background: none; border: none; color: var(--slow-brand); cursor: pointer; font-size: 13px; padding: 0; }
.wl-tag { padding: 2px 8px; border-radius: 10px; font-size: 12px; background: var(--bg-domain-hover, #f5f7fa); color: var(--text-secondary, #5a6172); }
.wl-tag.ok { background: var(--slow-ok-bg); color: var(--slow-ok); }
.wl-tag.bad { background: var(--slow-bad-bg); color: var(--slow-bad); }
.wl-tag.pending { background: var(--slow-warn-bg); color: var(--slow-warn); }
.slow-pager { display: flex; gap: 12px; align-items: center; margin-top: 14px; font-size: 13px; }
.slow-modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.slow-modal { background: var(--slow-panel); color: var(--text-primary, #14171c); border-radius: 10px; padding: 20px; width: 520px; max-width: 92vw; box-shadow: 0 8px 32px rgba(0,0,0,.2); }
.slow-modal h3 { margin: 0 0 12px; }
.slow-hint { font-size: 12px; color: var(--text-secondary, #5a6172); margin: 8px 0; }
.slow-sql-snip { font-family: monospace; font-size: 12px; background: var(--bg-domain-hover, #f5f7fa); padding: 10px; border-radius: 6px; max-height: 120px; overflow: auto; margin: 8px 0; }
.slow-kv { font-size: 13px; margin: 4px 0; color: var(--text-secondary, #5a6172); }
.slow-modal-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
textarea.slow-input { resize: vertical; font-family: inherit; }
</style>
