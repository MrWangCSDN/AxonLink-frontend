<template>
  <div class="slow-wrap">
    <!-- 顶部工具条 -->
    <div class="slow-toolbar">
      <div class="slow-tb-left">
        <input v-model="keyword" class="slow-input" placeholder="搜索 抽象SQL / 微服务 / 来源文件" @keyup.enter="reload" />
        <!-- v2：轮次下拉——展示永远是"某一轮"（默认最新一轮），可手选其他轮次；不提供"全部轮次" -->
        <select v-model="roundSel" class="slow-select" @change="page = 0; reload()">
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
          <option value="REJECTED_L1">一级退回</option>
          <option value="REJECTED_L2">二级退回</option>
        </select>
        <input v-model="initiator" class="slow-input" style="width:140px" placeholder="发起人 姓名/工号" @keyup.enter="reload" />
        <input v-model="curApprover" class="slow-input" style="width:150px" placeholder="当前审批人 姓名/工号" @keyup.enter="reload" />
        <select v-model="optimizeStatus" class="slow-select" @change="reload">
          <option value="">全部优化状态</option>
          <option value="NONE">未处理</option>
          <option value="OPTIMIZED">已优化</option>
          <option value="REGRESSED">优化未生效</option>
        </select>
        <button class="slow-btn" @click="reload">查询</button>
      </div>
      <div class="slow-tb-right">
        <button class="slow-btn" @click="openImport">导入 Excel/CSV</button>
        <button class="slow-btn" @click="openFilterCfg">采集过滤</button>
        <button class="slow-btn" @click="doExport">导出 Excel</button>
      </div>
    </div>

    <div v-if="filter?.myApprovalTodo" class="slow-todo-banner">
      🔔 仅显示「该我审批」的慢SQL（待一级 / 待二级）
      <button class="slow-link" @click="clearTodo">清除筛选</button>
    </div>
    <div class="slow-kpi">共 <b>{{ total }}</b> 条抽象SQL</div>

    <!-- 列表（v4：表头固定 + 表体滚动——本容器滚动，thead sticky；工具栏/分页脚在容器外固定）-->
    <div class="slow-table-scroll">
    <div v-if="loading" class="slow-state">加载中…</div>
    <div v-else-if="errorMsg" class="slow-state slow-err">{{ errorMsg }}</div>
    <div v-else-if="items.length === 0" class="slow-state">暂无数据，请先「导入 Excel/CSV」。</div>
    <table v-else class="slow-table">
      <thead>
        <tr>
          <th>微服务</th><th>领域</th><th>类型</th><th>抽象SQL</th><th class="num">最大执行耗时</th>
          <th>执行参数</th><th class="num">执行次数</th><th>来源文件</th><th>轮次</th><th>重复出现轮次</th><th>优化状态</th><th>白名单</th><th>发起人</th><th>当前审批人</th><th>操作</th>
        </tr>
      </thead>
      <tbody>
        <!-- v3：长字段列 hover 看全文（title）+ 点击复制全文 -->
        <tr v-for="it in items" :key="it.id">
          <td class="svc-cell copyable" :title="it.service_name + '\n（点击复制）'" @click="copyCell(it.service_name)">{{ it.service_name }}</td>
          <td>{{ it.domain }}</td>
          <td>{{ it.biz_type }}</td>
          <td class="sql-cell copyable" :title="it.abstract_sql + '\n（点击复制）'" @click="copyCell(it.abstract_sql)">{{ it.abstract_sql }}</td>
          <td class="num" :title="it.max_time_cost_raw">{{ it.max_time_cost_ms }}ms</td>
          <td class="param-cell copyable" :title="(it.exec_params || '') + '\n（点击复制）'" @click="copyCell(it.exec_params)">{{ it.exec_params }}</td>
          <td class="num">{{ it.exec_count }}</td>
          <td class="loc-cell copyable" :title="(it.source_location || '') + '\n（点击复制）'" @click="copyCell(it.source_location)">{{ it.source_location }}</td>
          <td>{{ it.round }}</td>
          <td class="rounds-cell copyable" :title="(it.repeat_rounds || '') + '\n（点击复制）'" @click="copyCell(it.repeat_rounds)">{{ it.repeat_rounds || '—' }}</td>
          <td><span class="wl-tag" :class="optClass(it.optimize_status)"
                @mouseenter="showJourney(it, $event)" @mouseleave="scheduleHideJourney">{{ optLabel(it) }}</span></td>
          <td><span class="wl-tag" :class="wlClass(it.whitelist_status)"
                @mouseenter="showJourney(it, $event)" @mouseleave="scheduleHideJourney">{{ wlLabel(it.whitelist_status) }}</span></td>
          <td class="who-cell">{{ personLabel(it.initiator, it.initiator_name) }}</td>
          <td class="who-cell">{{ personLabel(it.current_approver, it.current_approver_name) }}</td>
          <td>
            <div class="slow-act-col">
              <!-- 互斥：白名单与优化二选一。未处理→两个入口都给；优化生效中(OPTIMIZED)→只能编辑优化；
                   未生效(REGRESSED)→上次尝试已失败归档，路线重新开放：可「去优化」(全新一次)也可「申请白名单」 -->
              <button v-if="!it.whitelist_status && it.optimize_status !== 'OPTIMIZED'" class="slow-act-btn" @click="openApply(it)">申请白名单</button>
              <template v-if="it.whitelist_status">
                <button class="slow-act-btn" @click="openView(it)">{{ wlActionLabel(it.whitelist_status) }}</button>
                <button v-if="it.whitelist_status === 'REJECTED_L1' && it.optimize_status !== 'OPTIMIZED'" class="slow-act-btn" @click="reapplyWhitelist(it)">重新申请</button>
                <button v-if="it.whitelist_status === 'PENDING_L1' || it.whitelist_status === 'REJECTED_L1'" class="slow-act-btn" @click="withdrawWhitelist(it)">撤回申请</button>
              </template>
              <button v-if="isLatestRound && (it.optimize_status === 'OPTIMIZED' || !it.whitelist_status)" class="slow-act-btn" @click="openOptimize(it)">{{ it.optimize_status === 'OPTIMIZED' ? '编辑优化' : '去优化' }}</button>
              <button v-if="isLatestRound && it.optimize_status === 'OPTIMIZED'" class="slow-act-btn" @click="revokeOptimize(it)">撤销优化</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    </div>

    <!-- 分页（服务端分页；v3 加每页条数。导出不受分页影响=筛选后全量） -->
    <div class="slow-pager" v-if="total > 0">
      <button class="slow-btn" :disabled="page === 0" @click="page--; reload()">上一页</button>
      <span>{{ page + 1 }} / {{ Math.max(1, Math.ceil(total / pageSize)) }}</span>
      <button class="slow-btn" :disabled="(page + 1) * pageSize >= total" @click="page++; reload()">下一页</button>
      <select v-model.number="pageSize" class="slow-select" @change="page = 0; reload()">
        <option :value="20">20 条/页</option>
        <option :value="50">50 条/页</option>
        <option :value="100">100 条/页</option>
      </select>
      <span class="slow-pager-total">共 {{ total }} 条</span>
    </div>

    <!-- v3：复制成功浮动提示 -->
    <transition name="slow-fade">
      <div v-if="copyTip" class="slow-copy-toast">已复制到剪贴板</div>
    </transition>

    <!-- v3：采集过滤名单配置弹窗（增删需导入口令） -->
    <div v-if="filterOpen" class="slow-modal-mask" @click.self="filterOpen = false">
      <div class="slow-modal">
        <h3>SQL 采集过滤名单</h3>
        <p class="slow-hint">抽象SQL 以下列前缀<b>开头</b>的行，导入时不纳入采集（大小写不敏感，trim 后比对）。
          例：配置 EXPLAIN、SET 后，"EXPLAIN …" / "set session …" 都被过滤。增删需导入口令。</p>
        <div v-if="filterList.length === 0" class="slow-hint">名单为空——所有行都会被采集。</div>
        <ul v-else class="slow-filter-list">
          <li v-for="f in filterList" :key="f.id">
            <code class="slow-filter-prefix">{{ f.prefix }}</code>
            <button class="slow-link slow-filter-del" :disabled="filterBusy" @click="delFilter(f)">删除</button>
          </li>
        </ul>
        <div class="slow-filter-add">
          <input v-model="filterPrefix" class="slow-input" maxlength="64"
                 placeholder="新增前缀（如 EXPLAIN）" @keyup.enter="addFilter" />
          <button class="slow-btn primary" :disabled="!filterPrefix.trim() || filterBusy" @click="addFilter">新增</button>
        </div>
        <input v-model="filterToken" class="slow-input full" type="password"
               placeholder="口令 X-DII-Trigger-Token（与导入口令一致，增删必填）" />
        <p v-if="filterMsg" class="slow-hint">{{ filterMsg }}</p>
        <div class="slow-modal-foot">
          <button class="slow-btn" @click="filterOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 导入弹窗（v3：导入中显示等待层+进度，禁止误关；成功后按钮置灰防重复导入） -->
    <div v-if="importOpen" class="slow-modal-mask" @click.self="!importing && (importOpen = false)">
      <div class="slow-modal">
        <h3>导入慢SQL明细</h3>
        <p class="slow-hint">5 列：微服务 / 抽象SQL / 执行参数 / 执行耗时 / 来源文件；首行表头自动跳过。
          导入时按 (微服务+抽象SQL) 聚合：取最大耗时代表行并统计执行次数；同轮次重复导入会覆盖。</p>
        <input type="file" accept=".xlsx,.xls,.csv" :disabled="importing" @change="onFile" />
        <input v-model="importRound" class="slow-input full" maxlength="20" :disabled="importing"
               placeholder="轮次（必填，如 20260103-20260107）" />
        <input v-model="token" class="slow-input full" type="password" :disabled="importing"
               placeholder="导入口令 X-DII-Trigger-Token" />
        <!-- 等待层：上传+解析聚合期间显示不确定进度条（后端同步接口，无法回传精确百分比） -->
        <div v-if="importing" class="slow-import-wait">
          <div class="slow-prog"><div class="slow-prog-fill"></div></div>
          <p class="slow-hint">正在上传并解析聚合（30 万行约需 10~30 秒），请勿关闭或重复点击…</p>
        </div>
        <p v-if="importMsg" class="slow-hint">{{ importMsg }}</p>
        <div class="slow-modal-foot">
          <button class="slow-btn" :disabled="importing" @click="importOpen = false">{{ importDone ? '关闭' : '取消' }}</button>
          <button class="slow-btn primary"
                  :disabled="!importFileRef || !importRound.trim() || importing || importDone"
                  @click="doImport">{{ importing ? '导入中…' : (importDone ? '已导入' : '导入') }}</button>
        </div>
      </div>
    </div>

    <!-- 申请弹窗 -->
    <div v-if="applyOpen" class="slow-modal-mask" @click.self="applyOpen = false">
      <div class="slow-modal">
        <h3>申请白名单（慢SQL）</h3>
        <!-- v2：白名单粒度 = (微服务+抽象SQL)，明示申请范围 -->
        <div class="slow-kv">申请范围：微服务 <b>{{ applyRow?.service_name }}</b> + 下方抽象SQL（通过后覆盖该组合的所有轮次，并被后续导入继承）</div>
        <div class="slow-sql-snip">{{ applyRow?.abstract_sql }}</div>
        <select v-model="applyL1" class="slow-input full">
          <option value="">选择一级审批人</option>
          <option v-for="a in l1Approvers" :key="a.username" :value="a.username">{{ a.display || a.username }}</option>
        </select>
        <textarea v-model="applyReason" class="slow-input full" placeholder="申请理由（必填）" rows="3"></textarea>
        <p v-if="applyMsg" class="slow-hint">{{ applyMsg }}</p>
        <div class="slow-modal-foot">
          <button class="slow-btn" @click="applyOpen = false">取消</button>
          <button class="slow-btn primary" :disabled="!applyL1 || !applyReason.trim() || applying" @click="doApply">{{ applying ? '提交中…' : '提交申请' }}</button>
        </div>
      </div>
    </div>

    <!-- 查看/审批弹窗 -->
    <div v-if="viewOpen" class="slow-modal-mask" @click.self="viewOpen = false">
      <div class="slow-modal">
        <h3>白名单申请 #{{ viewApp?.id }}</h3>
        <div class="slow-kv">状态：<b>{{ wlLabel(viewApp?.status) }}</b></div>
        <div class="slow-kv">申请人：{{ viewApp?.applicant }}　一级：{{ approverDisplay(viewApp?.l1_approver) }}　二级：{{ viewApp?.l2_approver ? approverDisplay(viewApp.l2_approver) : '-' }}</div>
        <div class="slow-sql-snip">{{ viewApp?.sql_text }}</div>
        <!-- 申请理由 + 各级审批意见（有则显示，完整留痕） -->
        <div class="slow-kv">申请理由：{{ viewApp?.apply_reason || '—' }}</div>
        <div v-if="viewApp?.l1_opinion" class="slow-kv">一级意见（{{ approverDisplay(viewApp?.l1_approver) }}）：{{ viewApp.l1_opinion }}</div>
        <div v-if="viewApp?.l2_opinion" class="slow-kv">二级意见（{{ approverDisplay(viewApp?.l2_approver) }}）：{{ viewApp.l2_opinion }}</div>
        <textarea v-if="viewMode" v-model="viewOpinion" class="slow-input full" placeholder="审批意见（必填）" rows="2"></textarea>
        <select v-if="viewMode === 'l1'" v-model="viewL2" class="slow-input full">
          <option value="">通过时选择二级审批人</option>
          <option v-for="a in l2Approvers" :key="a.username" :value="a.username">{{ a.display || a.username }}</option>
        </select>
        <p v-if="viewMsg" class="slow-hint">{{ viewMsg }}</p>
        <div class="slow-modal-foot">
          <button class="slow-btn" @click="viewOpen = false">关闭</button>
          <template v-if="viewMode === 'l1'">
            <button class="slow-btn" :disabled="!viewOpinion.trim()" @click="act('l1Reject')">退回</button>
            <button class="slow-btn primary" :disabled="!viewL2 || !viewOpinion.trim()" @click="act('l1Approve')">一级通过</button>
          </template>
          <template v-else-if="viewMode === 'l2'">
            <button class="slow-btn" :disabled="!viewOpinion.trim()" @click="act('l2Reject')">退回</button>
            <button class="slow-btn primary" :disabled="!viewOpinion.trim()" @click="act('l2Approve')">二级通过</button>
          </template>
        </div>
      </div>
    </div>

    <!-- 已优化：填写优化内容弹窗（工号/姓名后端自动记当前登录用户） -->
    <div v-if="optimizeOpen" class="slow-modal-mask" @click.self="optimizeOpen = false">
      <div class="slow-modal">
        <h3>标记「已优化」</h3>
        <div class="slow-kv">微服务 <b>{{ optimizeRow?.service_name }}</b>（通过后覆盖该微服务+抽象SQL 的所有轮次）</div>
        <div class="slow-sql-snip">{{ optimizeRow?.abstract_sql }}</div>
        <div class="slow-kv">优化内容（必填，≤200 字）　<b>{{ optimizeNote.length }}/200</b></div>
        <textarea v-model="optimizeNote" class="slow-input full" rows="4" maxlength="200"
                  placeholder="请描述做了什么优化，例如：给 nxt_bal_btch_alct_dt + btch_grp_num 加联合索引"></textarea>
        <p class="slow-hint">工号 / 姓名自动记录当前登录用户，无需填写。</p>
        <p v-if="optimizeMsg" class="slow-hint">{{ optimizeMsg }}</p>
        <div class="slow-modal-foot">
          <button class="slow-btn" @click="optimizeOpen = false">取消</button>
          <button class="slow-btn primary" :disabled="!optimizeNote.trim() || optimizing" @click="doOptimize">{{ optimizing ? '提交中…' : '确定' }}</button>
        </div>
      </div>
    </div>

    <!-- 统一「处理路径」悬浮弹层：优化侧+白名单侧一条时间线（追加不删，跨多次申请/尝试） -->
    <div v-if="journey.open" class="opt-hist-pop" :style="{ left: journey.x + 'px', top: journey.y + 'px' }"
         @mouseenter="cancelHideJourney" @mouseleave="scheduleHideJourney">
      <div class="opt-hist-head">处理路径<span class="opt-hist-count">{{ journey.items.length }} 步</span></div>
      <div v-if="journey.loading" class="opt-hist-empty">加载中…</div>
      <div v-else-if="!journey.items.length" class="opt-hist-empty">暂无记录</div>
      <ol v-else class="opt-hist-list">
        <li v-for="(ev, i) in journey.items" :key="i" class="opt-hist-item">
          <div class="opt-hist-meta">
            <span class="wl-tag opt-hist-tag" :class="journeyMeta(ev).cls">{{ journeyMeta(ev).label }}</span>
            <span v-if="ev.round" class="opt-hist-round">{{ ev.round }}</span>
            <span class="opt-hist-who">{{ journeyWho(ev) }}</span>
            <span class="opt-hist-time">{{ journeyTime(ev.at) }}</span>
            <span v-if="ev.reappearedRound" class="wl-tag bad opt-hist-tag">未生效 · 又现于 {{ ev.reappearedRound }}</span>
            <span v-else-if="ev.action === 'MARK' && i === journey.items.length - 1 && journey.optStatus === 'OPTIMIZED'" class="wl-tag ok opt-hist-tag">生效中</span>
          </div>
          <div class="opt-hist-note">{{ ev.note || '—' }}</div>
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  listSlowSql, listSlowSqlDomains, listSlowSqlBizTypes, listSlowSqlRounds,
  importSlowSql, exportSlowSql,
  listSlowSqlCollectFilters, addSlowSqlCollectFilter, deleteSlowSqlCollectFilter,
  getWhitelistApprovers, applyWhitelist, getWhitelistApplication,
  l1Approve, l1Reject, l2Approve, l2Reject, cancelWhitelist,
  markSlowSqlOptimized, revokeSlowSqlOptimized, getSlowSqlJourney,
} from '../../api/daoIndex.js'
import { getCurrentUser } from '../../api/auth.js'

const props = defineProps({
  env: { type: String, default: 'uat' },
  filter: { type: Object, default: () => ({}) },   // { myApprovalTodo } —— 铃铛慢SQL待办跳来
})
const emit = defineEmits(['update:env', 'clear-todo-filter'])

const items = ref([]); const total = ref(0); const loading = ref(false); const errorMsg = ref('')
const keyword = ref(''); const domain = ref(''); const bizType = ref(''); const whitelistStatus = ref('')
const optimizeStatus = ref('')
const initiator = ref('')
const curApprover = ref('')
// v3：每页条数可选（20/50/100），服务端分页
const domains = ref([]); const bizTypes = ref([]); const page = ref(0); const pageSize = ref(50)
// v2：轮次（后端升序返回；下拉倒序展示，默认选最新一轮）
const rounds = ref([]); const roundSel = ref('')
const roundsDesc = computed(() => rounds.value.slice().reverse())
// 仅「最新一轮」可改「已优化」；选中历史轮次时按钮隐藏（只读）。后端升序返回，末位=最新。
const isLatestRound = computed(() =>
  rounds.value.length > 0 && roundSel.value === rounds.value[rounds.value.length - 1])

const currentUser = ref('')
const l1Approvers = ref([]); const l2Approvers = ref([])

async function reload() {
  loading.value = true; errorMsg.value = ''
  journeyCache.clear()   // 数据可能变了（打标/导入/审批），处理路径缓存作废
  try {
    const data = await listSlowSql({
      keyword: keyword.value, domain: domain.value, bizType: bizType.value,
      whitelistStatus: whitelistStatus.value,
      optimizeStatus: optimizeStatus.value,
      initiator: initiator.value || undefined,
      curApprover: curApprover.value || undefined,
      round: roundSel.value || undefined,   // v2：按轮次过滤（空=全部轮次）
      // 铃铛「慢SQL待办」跳来：只看该我审批的待审慢SQL
      approverUser: props.filter?.myApprovalTodo ? (currentUser.value || undefined) : undefined,
      limit: pageSize.value, offset: page.value * pageSize.value,
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
// v3：导入成功后置 true → 按钮置灰"已导入"，防重复导入；换文件/改轮次才解锁
const importDone = ref(false)
watch(importRound, () => { importDone.value = false })
// 打开导入弹窗时清掉上一次的文件/提示，保证重复导入同名文件也能再次触发 @change
function openImport() { importFileRef.value = null; importMsg.value = ''; importDone.value = false; importOpen.value = true }
function onFile(e) { importFileRef.value = e.target.files?.[0] || null; importDone.value = false }
async function doImport() {
  // v3：importing 防双击连点；importDone 防成功后重复导入
  if (!importFileRef.value || !importRound.value.trim() || importing.value || importDone.value) return
  importing.value = true; importMsg.value = ''
  try {
    const r = await importSlowSql(importFileRef.value, props.env, token.value, importRound.value.trim())
    importMsg.value = `轮次 ${r.round}：原始 ${r.rawRows} 行 → 聚合 ${r.aggregatedRows} 条`
      + `（${r.repeatHit} 条曾在历史轮次出现，跳过 ${r.skipped}`
      + `${r.filtered ? `，采集过滤名单排除 ${r.filtered} 行` : ''}`
      + `${r.overwritten ? `，覆盖旧轮 ${r.overwritten} 条` : ''}`
      + `${r.reappearedHit ? `，本轮 ${r.reappearedHit} 条优化未生效` : ''}）`
    page.value = 0
    domains.value = await listSlowSqlDomains()
    bizTypes.value = await listSlowSqlBizTypes()
    // 刷新轮次下拉并切到刚导入的轮次
    try { rounds.value = await listSlowSqlRounds() } catch { /* ignore */ }
    roundSel.value = r.round
    importDone.value = true   // v3：成功后置灰导入按钮，防重复导入
    await reload()
  } catch (e) {
    importMsg.value = e.code === 'TOKEN_INVALID' ? '口令错误' : `导入失败：${e?.message || e}`
  } finally {
    importing.value = false
  }
}

/* ── 导出（v3：与页面筛选联动——筛选 100 条分 5 页，导出 100 条；列与页面一致）── */
async function doExport() {
  try {
    await exportSlowSql({
      env: props.env,
      round: roundSel.value || undefined,
      domain: domain.value || undefined,
      bizType: bizType.value || undefined,
      keyword: keyword.value || undefined,
      whitelistStatus: whitelistStatus.value || undefined,
      optimizeStatus: optimizeStatus.value || undefined,
    })
  } catch (e) { alert(`导出失败：${e?.message || e}`) }
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
      // v2：白名单粒度 = (微服务+抽象SQL)，微服务名借 projectName 字段携带（后端必填校验）
      projectName: applyRow.value.service_name,
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
    if ((app?.status === 'PENDING_L1' || app?.status === 'REJECTED_L2') && app?.l1_approver === u) viewMode.value = 'l1'
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

/* ── v3 采集过滤名单配置（增删需导入口令）── */
const filterOpen = ref(false); const filterList = ref([])
const filterPrefix = ref(''); const filterToken = ref(''); const filterMsg = ref(''); const filterBusy = ref(false)
async function openFilterCfg() {
  filterMsg.value = ''; filterPrefix.value = ''
  filterOpen.value = true
  await loadFilters()
}
async function loadFilters() {
  try { filterList.value = await listSlowSqlCollectFilters() } catch (e) { filterMsg.value = `加载失败：${e?.message || e}` }
}
async function addFilter() {
  const p = filterPrefix.value.trim()
  if (!p || filterBusy.value) return
  filterBusy.value = true; filterMsg.value = ''
  try {
    await addSlowSqlCollectFilter(p, filterToken.value)
    filterPrefix.value = ''
    filterMsg.value = `已新增前缀「${p}」（下次导入生效）`
    await loadFilters()
  } catch (e) {
    filterMsg.value = e.code === 'TOKEN_INVALID' ? '口令错误' : `新增失败：${e?.message || e}`
  } finally {
    filterBusy.value = false
  }
}
async function delFilter(f) {
  if (filterBusy.value) return
  filterBusy.value = true; filterMsg.value = ''
  try {
    await deleteSlowSqlCollectFilter(f.id, filterToken.value)
    filterMsg.value = `已删除前缀「${f.prefix}」`
    await loadFilters()
  } catch (e) {
    filterMsg.value = e.code === 'TOKEN_INVALID' ? '口令错误' : `删除失败：${e?.message || e}`
  } finally {
    filterBusy.value = false
  }
}

/* ── v3 单元格复制（hover 看全文 title，点击复制全文）── */
const copyTip = ref(false)
let copyTipTimer = null
async function copyCell(text) {
  if (!text) return
  const ok = await copyText(String(text))
  if (!ok) return
  copyTip.value = true
  clearTimeout(copyTipTimer)
  copyTipTimer = setTimeout(() => { copyTip.value = false }, 1200)
}
/**
 * 兼容复制：优先 Clipboard API；内网 http（非 secure context）下不可用，
 * 兜底 textarea + execCommand('copy')。
 */
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fallthrough 到兜底 */ }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  try { return document.execCommand('copy') } catch { return false } finally { document.body.removeChild(ta) }
}

/* 审批人 username → 中文显示名（在 l1/l2 名单里找 display）；找不到原样返回 username */
function approverDisplay(username) {
  if (!username) return username
  const hit = [...l1Approvers.value, ...l2Approvers.value].find(a => a.username === username)
  return hit?.display || username
}

/* ── 文案 ── */
function wlLabel(s) {
  return ({ PENDING_L1: '待一级', PENDING_L2: '待二级', APPROVED: '已通过', REJECTED_L1: '一级退回', REJECTED_L2: '二级退回', CANCELLED: '已取消' })[s] || '未申请'
}
function wlClass(s) {
  if (s === 'APPROVED') return 'ok'
  if (s === 'REJECTED_L1' || s === 'REJECTED_L2') return 'bad'
  if (s === 'PENDING_L1' || s === 'PENDING_L2') return 'pending'
  return ''
}
/* 操作列白名单按钮文案：待审=查看审批（审批人可操作），其余（已通过/已退回）=查看详情 */
function wlActionLabel(s) {
  // 待审 + 二级退回(回一级重审) 都是"可审批"入口；已通过/一级退回是查看
  return (s === 'PENDING_L1' || s === 'PENDING_L2' || s === 'REJECTED_L2') ? '查看审批' : '查看详情'
}
/* 人员显示：姓名(工号)；只有工号显示工号；无 → — */
function personLabel(emp, name) {
  if (name && emp) return `${name}(${emp})`
  return name || emp || '—'
}
/* 已退回 → 重新申请：先取消旧申请（后端校验仅申请人本人可取消），再打开申请弹窗 */
async function reapplyWhitelist(it) {
  if (!it.whitelist_app_id) { alert('缺少原申请信息，无法重新申请'); return }
  if (!window.confirm('重新申请将取消已退回的旧申请，是否继续？')) return
  try {
    await cancelWhitelist(it.whitelist_app_id, { currentUser: currentUser.value })
    await reload()
    openApply(it)
  } catch (e) {
    alert(`重新申请失败：${e?.message || e}`)
  }
}

/* 撤回申请（申请人本人，后端校验；撤回后白名单清空 → 可走去优化） */
async function withdrawWhitelist(it) {
  if (!it.whitelist_app_id) { alert('缺少申请信息，无法撤回'); return }
  if (!window.confirm('确定撤回该白名单申请？\n\n撤回后状态回「未申请」，可重新申请白名单或走去优化流程；\n撤回动作会记录到白名单流转路径。')) return
  try {
    await cancelWhitelist(it.whitelist_app_id, { currentUser: currentUser.value })
    await reload()
  } catch (e) {
    alert(`撤回失败：${e?.message || e}`)
  }
}

/* ── 优化状态：文案带轮次上下文 + 标签色（复用 wl-tag 的 ok/bad） ── */
function optLabel(it) {
  const s = it.optimize_status
  if (!s) return '未处理'
  if (s === 'OPTIMIZED') return `已优化 @${it.optimized_round || ''}`
  if (s === 'REGRESSED') return `未生效（${it.optimized_round || ''} 标→${it.reappeared_round || ''} 现）`
  return s
}
function optClass(s) {
  if (s === 'OPTIMIZED') return 'ok'
  if (s === 'REGRESSED') return 'bad'
  return ''
}
/* ── 统一「处理路径」悬浮弹层：优化侧(标记/撤销) + 白名单侧(申请/审批/退回/撤回)
   按时间升序合并成一条时间线——悬浮「优化状态」或「白名单」列均显示 ── */
const journey = ref({ open: false, x: 0, y: 0, loading: false, items: [], key: '', optStatus: '' })
const journeyCache = new Map()
let journeyHideTimer = null
const JOURNEY_META = {
  'OPTIMIZE.MARK':   { label: '标记已优化', cls: 'ok' },
  'OPTIMIZE.REVOKE': { label: '撤销优化',   cls: '' },
  'WHITELIST.APPLY':      { label: '申请白名单', cls: '' },
  'WHITELIST.L1_APPROVE': { label: '一级通过', cls: 'ok' },
  'WHITELIST.L1_REJECT':  { label: '一级退回', cls: 'bad' },
  'WHITELIST.L2_APPROVE': { label: '申请通过', cls: 'ok' },
  'WHITELIST.L2_REJECT':  { label: '二级退回', cls: 'bad' },
  'WHITELIST.CANCEL':     { label: '撤回申请', cls: '' },
}
function journeyMeta(ev) { return JOURNEY_META[`${ev.kind}.${ev.action}`] || { label: ev.action, cls: '' } }
function journeyTime(v) { return v ? String(v).slice(0, 16) : '' }
function journeyWho(ev) {
  const name = ev.actorName, emp = ev.actor
  if (name && emp) return `${name}(${emp})`
  return name || emp || '—'
}
async function showJourney(it, e) {
  clearTimeout(journeyHideTimer)
  const rect = e.currentTarget.getBoundingClientRect()
  const key = it.service_name + '\n' + it.abstract_hash
  journey.value = {
    open: true, key, optStatus: it.optimize_status || '',
    x: Math.min(rect.left, window.innerWidth - 400),
    y: rect.bottom + 6,
    loading: !journeyCache.has(key),
    items: journeyCache.get(key) || [],
  }
  if (!journeyCache.has(key)) {
    let items = []
    try { items = await getSlowSqlJourney(it.service_name, it.abstract_hash) } catch { /* 弹层容错 */ }
    journeyCache.set(key, items)
    if (journey.value.key === key) { journey.value = { ...journey.value, loading: false, items } }
  }
}
function scheduleHideJourney() {
  clearTimeout(journeyHideTimer)
  journeyHideTimer = setTimeout(() => { journey.value = { ...journey.value, open: false } }, 150)
}
function cancelHideJourney() { clearTimeout(journeyHideTimer) }

/* ── 已优化：弹框填优化内容(必填≤200)，提交后端记工号+姓名。已优化后可再点「编辑优化」改内容 ── */
const optimizeOpen = ref(false)
const optimizeRow = ref(null)
const optimizeNote = ref('')
const optimizing = ref(false)
const optimizeMsg = ref('')
function openOptimize(it) {
  optimizeRow.value = it
  // 仅「生效中(OPTIMIZED)」的编辑预填现有内容；未生效/未处理 = 全新一次尝试，空白重填
  optimizeNote.value = it.optimize_status === 'OPTIMIZED' ? (it.optimize_note || '') : ''
  optimizeMsg.value = ''
  optimizeOpen.value = true
}
async function doOptimize() {
  const note = optimizeNote.value.trim()
  if (!note) { optimizeMsg.value = '优化内容不能为空'; return }
  if (note.length > 200) { optimizeMsg.value = '优化内容不能超过 200 字'; return }
  optimizing.value = true; optimizeMsg.value = ''
  try {
    await markSlowSqlOptimized({
      serviceName: optimizeRow.value.service_name,
      abstractHash: optimizeRow.value.abstract_hash,
      note,
    })
    optimizeOpen.value = false
    await reload()
  } catch (e) {
    optimizeMsg.value = `提交失败：${e?.message || e}`
  } finally {
    optimizing.value = false
  }
}

/* ── 撤销优化（互斥出口：生效中想走白名单须先撤销；确认后执行，后端记撤销人+时间，路线留痕）── */
async function revokeOptimize(it) {
  const ok = window.confirm(
    '确定撤销该SQL的「已优化」标记？\n\n' +
    '撤销后状态回「未处理」，可重新去优化或申请白名单；\n' +
    '撤销人与时间将记录到优化路线（可悬浮查看），历史不会被删除。')
  if (!ok) return
  try {
    await revokeSlowSqlOptimized({ serviceName: it.service_name, abstractHash: it.abstract_hash })
    await reload()
  } catch (e) {
    alert(`撤销失败：${e?.message || e}`)
  }
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

/* v4：固定 工具栏/KPI 在顶、分页脚在底，中间表格区滚动。
   .slow-wrap 作 flex 列并撑满父高（DaoIndexPage 的 .dii-main 是 overflow:hidden 的 flex 列）。 */
.slow-wrap { padding: 16px; color: var(--text-primary, #14171c);
  display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%; box-sizing: border-box; }
.slow-toolbar, .slow-todo-banner, .slow-kpi, .slow-pager { flex-shrink: 0; }
/* 中间滚动区：本容器纵向滚动；表头 thead 用 sticky 钉在容器顶部 */
.slow-table-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
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
/* v4：表头钉在滚动容器顶部——不透明背景盖住下方滚动行；z-index 高于行内容 */
.slow-table th {
  color: var(--text-secondary, #5a6172); font-weight: 600;
  position: sticky; top: 0; z-index: 2; background: var(--slow-panel);
}
.slow-table .num { text-align: right; white-space: nowrap; }
.sql-cell { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
.param-cell { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary, #5a6172); }
/* v2：微服务 / 来源文件 / 重复出现轮次 截断单元格 */
.svc-cell { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.loc-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; font-size: 12px; color: var(--text-secondary, #5a6172); }
.who-cell { white-space: nowrap; color: var(--text-secondary, #5a6172); font-size: 12px; }
.rounds-cell { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary, #5a6172); }
.slow-link { background: none; border: none; color: var(--slow-brand); cursor: pointer; font-size: 13px; padding: 0; }
/* 操作列：按钮样式，文字单行不换行，多个按钮纵向排列 */
.slow-act-col { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.slow-act-btn {
  padding: 3px 10px; border: 1px solid var(--slow-brand); border-radius: 6px;
  background: transparent; color: var(--slow-brand);
  cursor: pointer; font-size: 12px; line-height: 1.5; white-space: nowrap;
}
.slow-act-btn:hover { background: var(--slow-brand); color: var(--slow-on-brand); }
/* ── 优化路线悬浮弹层：时间线，简洁清晰，token 亮暗自适应 ── */
.opt-hist-pop {
  position: fixed; z-index: 1300; width: 360px; max-height: 320px; overflow: auto;
  background: var(--slow-panel); color: var(--text-primary, #14171c);
  border: 1px solid var(--border, #d4d8dd); border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0,0,0,.18); padding: 12px 14px; font-size: 12px;
}
.opt-hist-head { font-size: 13px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.opt-hist-count { font-weight: 400; font-size: 11px; color: var(--text-secondary, #5a6172); }
.opt-hist-empty { color: var(--text-secondary, #5a6172); padding: 6px 0; }
.opt-hist-list { list-style: none; margin: 0; padding: 0; }
/* 时间线：左侧竖线 + 圆点 */
.opt-hist-item { position: relative; padding: 0 0 10px 16px; border-left: 2px solid var(--border-subtle, #ebeef2); margin-left: 5px; }
.opt-hist-item:last-child { padding-bottom: 0; }
.opt-hist-item::before {
  content: ''; position: absolute; left: -5px; top: 4px; width: 8px; height: 8px;
  border-radius: 50%; background: var(--slow-brand); border: 2px solid var(--slow-panel);
}
.opt-hist-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.opt-hist-round { font-family: monospace; font-weight: 600; }
.opt-hist-who { color: var(--text-primary, #14171c); }
.opt-hist-time { color: var(--text-secondary, #5a6172); font-size: 11px; }
.opt-hist-tag { font-size: 11px; padding: 1px 6px; }
.opt-hist-note { margin-top: 3px; color: var(--text-secondary, #5a6172); line-height: 1.5; word-break: break-all; }
.wl-tag { padding: 2px 8px; border-radius: 10px; font-size: 12px; background: var(--bg-domain-hover, #f5f7fa); color: var(--text-secondary, #5a6172); }
.wl-tag.ok { background: var(--slow-ok-bg); color: var(--slow-ok); }
.wl-tag.bad { background: var(--slow-bad-bg); color: var(--slow-bad); }
.wl-tag.pending { background: var(--slow-warn-bg); color: var(--slow-warn); }
.slow-pager { display: flex; gap: 12px; align-items: center; margin-top: 14px; font-size: 13px; }
.slow-pager-total { color: var(--text-secondary, #5a6172); }

/* ── v3：导入等待层（不确定进度条——后端同步接口无精确百分比） ── */
.slow-import-wait { margin-top: 10px; }
.slow-prog { height: 6px; border-radius: 3px; overflow: hidden; background: var(--bg-domain-hover, #f5f7fa); position: relative; }
.slow-prog-fill {
  position: absolute; top: 0; bottom: 0; width: 36%;
  border-radius: 3px; background: var(--slow-brand);
  animation: slow-prog-slide 1.2s ease-in-out infinite;
}
@keyframes slow-prog-slide {
  0%   { left: -36%; }
  100% { left: 100%; }
}

/* ── v3：采集过滤名单弹窗 ── */
.slow-filter-list { list-style: none; margin: 8px 0; padding: 0; max-height: 220px; overflow: auto; }
.slow-filter-list li {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px; border-bottom: 1px solid var(--border-subtle, #ebeef2);
}
.slow-filter-prefix { font-family: monospace; font-size: 13px; }
.slow-filter-del { color: var(--slow-bad); }
.slow-filter-add { display: flex; gap: 8px; margin-top: 8px; }
.slow-filter-add .slow-input { flex: 1; }

/* ── v3：可复制单元格 + 复制成功 toast ── */
.copyable { cursor: copy; }
.copyable:hover { background: var(--bg-domain-hover, #f5f7fa); }
.slow-copy-toast {
  position: fixed; left: 50%; bottom: 48px; transform: translateX(-50%);
  padding: 8px 18px; border-radius: 6px; font-size: 13px; z-index: 1200;
  background: var(--slow-ok-bg); color: var(--slow-ok);
  border: 1px solid var(--slow-ok); box-shadow: 0 4px 16px rgba(0,0,0,.15);
}
.slow-fade-enter-active, .slow-fade-leave-active { transition: opacity .25s ease; }
.slow-fade-enter-from, .slow-fade-leave-to { opacity: 0; }
.slow-modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.slow-modal { background: var(--slow-panel); color: var(--text-primary, #14171c); border-radius: 10px; padding: 20px; width: 520px; max-width: 92vw; box-shadow: 0 8px 32px rgba(0,0,0,.2); }
.slow-modal h3 { margin: 0 0 12px; }
.slow-hint { font-size: 12px; color: var(--text-secondary, #5a6172); margin: 8px 0; }
.slow-sql-snip { font-family: monospace; font-size: 12px; background: var(--bg-domain-hover, #f5f7fa); padding: 10px; border-radius: 6px; max-height: 120px; overflow: auto; margin: 8px 0; }
.slow-kv { font-size: 13px; margin: 4px 0; color: var(--text-secondary, #5a6172); }
.slow-modal-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
textarea.slow-input { resize: vertical; font-family: inherit; }
</style>
