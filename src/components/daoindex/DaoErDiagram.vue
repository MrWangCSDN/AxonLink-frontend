<template>
  <div class="er-page">
    <!-- 顶部 sticky：面包屑 + 标题 + 工具栏 -->
    <div class="er-sticky">
      <div class="er-breadcrumb">
        <span class="er-bc-home">SQL 巡检</span>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M5 3.5L8.5 7L5 10.5" stroke="#C5CBD7" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="er-bc-current">ER 图</span>
      </div>

      <div class="er-header">
        <h2 class="er-title">表关系 ER 图</h2>
        <div class="er-actions">
          <DiiEnvSwitcher :model-value="env" @update:model-value="$emit('update:env', $event)" />
          <button class="er-btn" :disabled="rebuilding" @click="openRebuild">
            {{ rebuilding ? '重算中…' : '重算关系' }}
          </button>
          <button class="er-btn" :disabled="!centerTable" @click="doExport">导出 Excel</button>
        </div>
      </div>

      <!-- 工具行：中心表搜索 + 跳数 + 置信度 -->
      <div class="er-toolbar">
        <div class="er-search">
          <input
            v-model="tableQuery"
            class="er-search-input"
            placeholder="搜索表名作为中心表…"
            @input="onSearchInput"
            @focus="searchOpen = true"
          />
          <div v-if="searchOpen && tableSuggest.length" class="er-suggest">
            <div
              v-for="t in tableSuggest"
              :key="t"
              class="er-suggest-item"
              @mousedown.prevent="selectCenter(t)"
            >{{ t }}</div>
          </div>
        </div>

        <!-- v3：固定 1 跳 + 仅联合主键全覆盖（HIGH），不再提供选择器 -->
        <span class="er-scope-tag">1 跳 · 仅联合主键全覆盖关系</span>

        <span v-if="centerTable" class="er-center-pill">
          中心：<code>{{ centerTable }}</code>
          <span class="er-center-stat">{{ graph.nodeCount || 0 }} 表 / {{ graph.edgeCount || 0 }} 关系</span>
        </span>
      </div>
    </div>

    <!-- 画布 -->
    <div class="er-canvas-wrap">
      <div v-if="loading" class="er-state">加载中…</div>
      <div v-else-if="errorMsg" class="er-state er-state-err">
        {{ errorMsg }}
        <button class="er-retry" @click="reloadGraph">重试</button>
      </div>
      <div v-else-if="!centerTable" class="er-state">
        请在上方搜索框选择一张「中心表」，将展示它的 1 跳关系。
        <div class="er-hint">提示：若无数据，先点右上角「重算关系」扫描目标库推断主键关系。</div>
      </div>
      <div v-else-if="nodes.length === 0" class="er-state">
        <code>{{ centerTable }}</code> 没有「联合主键全覆盖」关系（本页仅展示该类强关系）。
      </div>

      <svg
        v-else
        class="er-svg"
        ref="svgRef"
        @wheel.prevent="onWheel"
        @mousedown="onCanvasDown"
        @mousemove="onMove"
        @mouseup="onUp"
        @mouseleave="onUp"
      >
        <g :transform="`translate(${pan.x},${pan.y}) scale(${scale})`">
          <!-- 边 -->
          <g>
            <line
              v-for="e in edgesView"
              :key="e.id"
              :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2"
              :class="['er-edge', `er-edge-${(e.confidence||'').toLowerCase()}`, { 'er-edge-ignored': e.status==='IGNORED' }]"
              @click.stop="openEdge(e)"
            />
          </g>
          <!-- 节点 -->
          <g
            v-for="n in nodesView"
            :key="n.table"
            :transform="`translate(${n.x},${n.y})`"
            class="er-node"
            :class="{ 'er-node-center': n.table === centerTable }"
            @mousedown.stop="onNodeDown(n, $event)"
            @dblclick.stop="selectCenter(n.table)"
          >
            <rect class="er-node-box" :width="NODE_W" :height="n.height" rx="6" />
            <rect class="er-node-head" :width="NODE_W" height="26" rx="6" />
            <text class="er-node-title" :x="NODE_W/2" y="17">{{ n.table }}</text>
            <g v-for="(c, ci) in n.columns" :key="c.name">
              <text
                class="er-node-col"
                :class="{ 'er-col-key': c.isKey, 'er-col-fk': c.isFk }"
                x="10" :y="26 + 16 * (ci + 1)"
              >{{ c.isKey ? '🔑 ' : (c.isFk ? '↳ ' : '') }}{{ c.name }}</text>
            </g>
          </g>
        </g>
      </svg>

      <!-- 边详情卡片 -->
      <div v-if="edgeCard.open" class="er-edge-card" :style="{ left: edgeCard.x + 'px', top: edgeCard.y + 'px' }">
        <div class="er-edge-card-h">
          <span>关系详情</span>
          <button class="er-edge-card-x" @click="edgeCard.open = false">×</button>
        </div>
        <div class="er-edge-card-row"><b>{{ edgeCard.from }}</b> ← <b>{{ edgeCard.to }}</b></div>
        <div class="er-edge-card-row">关联列：<code>{{ (edgeCard.joinColumns||[]).join(', ') }}</code></div>
        <div class="er-edge-card-row">键类型：{{ edgeCard.keyType }} · 置信度：
          <span :class="`er-conf-${(edgeCard.confidence||'').toLowerCase()}`">{{ confLabel(edgeCard.confidence) }}</span>
        </div>
        <div class="er-edge-card-row">状态：{{ statusLabel(edgeCard.status) }}</div>
        <div class="er-edge-card-actions">
          <button class="er-btn er-btn-ok" @click="setStatus(edgeCard.id, 'CONFIRMED')">确认</button>
          <button class="er-btn er-btn-warn" @click="setStatus(edgeCard.id, 'IGNORED')">忽略</button>
        </div>
      </div>
    </div>

    <!-- 重算口令弹窗 -->
    <div v-if="rebuildAsk.open" class="er-modal-mask" @click.self="rebuildAsk.open = false">
      <div class="er-modal">
        <div class="er-modal-h"><h3>重算 ER 关系</h3><button class="er-modal-x" @click="rebuildAsk.open = false">×</button></div>
        <div class="er-modal-b">
          <p class="er-modal-tip">扫描 {{ env }} 目标库全部表，按「键包含」推断隐式外键。已人工确认/忽略的关系会保留。</p>
          <div class="er-form-row">
            <label>口令</label>
            <input ref="rebuildTokenRef" v-model="rebuildToken" type="password" class="er-input" placeholder="触发口令" @keyup.enter="confirmRebuild" />
          </div>
          <div v-if="rebuildAsk.error" class="er-form-err">{{ rebuildAsk.error }}</div>
          <div v-if="rebuildAsk.result" class="er-form-ok">{{ rebuildAsk.result }}</div>
        </div>
        <div class="er-modal-f">
          <button class="er-btn" @click="rebuildAsk.open = false">关闭</button>
          <button class="er-btn er-btn-primary" :disabled="!rebuildToken || rebuilding" @click="confirmRebuild">
            {{ rebuilding ? '重算中…' : '开始重算' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, watch } from 'vue'
import DiiEnvSwitcher from './widgets/DiiEnvSwitcher.vue'
import { erTables, erGraph, erRebuild, setErStatus, exportErRelations } from '../../api/daoIndex.js'

const props = defineProps({ env: { type: String, default: 'uat' } })
defineEmits(['update:env'])

const NODE_W = 200

/* ─── 状态 ─── */
const tableQuery = ref('')
const tableSuggest = ref([])
const searchOpen = ref(false)
const centerTable = ref('')
// v3：固定 1 跳 + 仅 HIGH（联合主键全覆盖）。不再提供 UI 选择，常量即可。
const hops = 1
const minConfidence = 'HIGH'
const graph = ref({ nodes: [], edges: [], nodeCount: 0, edgeCount: 0 })
const loading = ref(false)
const errorMsg = ref('')

// 视图布局态：table → {x,y}
const layout = reactive({})
const pan = reactive({ x: 80, y: 80 })
const scale = ref(1)
const svgRef = ref(null)

// 会话内缓存口令（重算/改状态复用）
const sessionToken = ref('')

/* ─── 表搜索 ─── */
let searchTimer = null
function onSearchInput() {
  searchOpen.value = true
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    try {
      const list = await erTables(props.env, tableQuery.value.trim())
      tableSuggest.value = Array.isArray(list) ? list.slice(0, 30) : []
    } catch { tableSuggest.value = [] }
  }, 200)
}

async function selectCenter(t) {
  centerTable.value = t
  tableQuery.value = t
  searchOpen.value = false
  await reloadGraph()
}

/**
 * 自动选「关系最多的表」作中心（打开页面 / 重算后调用）。
 * listTables 已按关系度降序，取第一个即最有料的表 → 画布立即有内容。
 */
async function autoSelectFirstTable() {
  try {
    const list = await erTables(props.env, '')
    if (Array.isArray(list) && list.length > 0) {
      await selectCenter(list[0])
      return true
    }
  } catch { /* 无数据/失败：保持空状态，由空态引导去重算 */ }
  return false
}

// 打开页面就尝试自动展示（有数据则直接画最有料的表）
onMounted(autoSelectFirstTable)
// 切 env 重新自动选
watch(() => props.env, () => {
  centerTable.value = ''
  graph.value = { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 }
  autoSelectFirstTable()
})

/* ─── 加载子图 ─── */
async function reloadGraph() {
  if (!centerTable.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const g = await erGraph({
      env: props.env, table: centerTable.value, hops, minConfidence,
    })
    graph.value = g || { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 }
    computeInitialLayout()
  } catch (e) {
    errorMsg.value = `加载失败：${e?.message || e}`
    graph.value = { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 }
  } finally {
    loading.value = false
  }
}

const nodes = computed(() => graph.value.nodes || [])

/** 放射状初始布局：中心居中，其余环绕。 */
function computeInitialLayout() {
  Object.keys(layout).forEach(k => delete layout[k])
  const list = nodes.value
  const cx = 480, cy = 320, radius = 280
  const others = list.filter(n => n.table !== centerTable.value)
  layout[centerTable.value] = { x: cx, y: cy }
  others.forEach((n, i) => {
    const ang = (2 * Math.PI * i) / Math.max(1, others.length)
    layout[n.table] = { x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang) }
  })
  // 没中心（full 模式兜底）：网格
  if (!layout[centerTable.value]) {
    list.forEach((n, i) => { layout[n.table] = { x: 60 + (i % 5) * 230, y: 60 + Math.floor(i / 5) * 200 } })
  }
  pan.x = 80; pan.y = 80; scale.value = 1
}

function nodeHeight(n) { return 26 + 16 * ((n.columns || []).length) + 10 }

const nodesView = computed(() =>
  nodes.value.map(n => ({
    ...n,
    x: (layout[n.table] || { x: 0 }).x,
    y: (layout[n.table] || { y: 0 }).y,
    height: nodeHeight(n),
  })),
)

/** 边端点取两节点盒子中心。 */
const edgesView = computed(() =>
  (graph.value.edges || []).map(e => {
    const a = layout[e.from] || { x: 0, y: 0 }
    const b = layout[e.to] || { x: 0, y: 0 }
    const na = nodes.value.find(n => n.table === e.from)
    const nb = nodes.value.find(n => n.table === e.to)
    const ha = na ? nodeHeight(na) : 40
    const hb = nb ? nodeHeight(nb) : 40
    return {
      ...e,
      x1: a.x + NODE_W / 2, y1: a.y + ha / 2,
      x2: b.x + NODE_W / 2, y2: b.y + hb / 2,
    }
  }),
)

/* ─── 平移 / 缩放 / 拖节点 ─── */
const drag = reactive({ mode: '', startX: 0, startY: 0, node: null, origX: 0, origY: 0 })

function onWheel(ev) {
  const delta = ev.deltaY < 0 ? 1.1 : 0.9
  scale.value = Math.min(2.5, Math.max(0.2, scale.value * delta))
}
function onCanvasDown(ev) {
  drag.mode = 'pan'; drag.startX = ev.clientX - pan.x; drag.startY = ev.clientY - pan.y
}
function onNodeDown(n, ev) {
  drag.mode = 'node'; drag.node = n.table
  drag.startX = ev.clientX; drag.startY = ev.clientY
  const p = layout[n.table] || { x: 0, y: 0 }
  drag.origX = p.x; drag.origY = p.y
}
function onMove(ev) {
  if (drag.mode === 'pan') {
    pan.x = ev.clientX - drag.startX; pan.y = ev.clientY - drag.startY
  } else if (drag.mode === 'node' && drag.node) {
    const dx = (ev.clientX - drag.startX) / scale.value
    const dy = (ev.clientY - drag.startY) / scale.value
    layout[drag.node] = { x: drag.origX + dx, y: drag.origY + dy }
  }
}
function onUp() { drag.mode = ''; drag.node = null }

/* ─── 边详情卡片 ─── */
const edgeCard = reactive({ open: false, x: 0, y: 0, id: null, from: '', to: '', joinColumns: [], keyType: '', confidence: '', status: '' })
function openEdge(e) {
  Object.assign(edgeCard, { ...e, open: true, x: 80, y: 120 })
}

async function setStatus(id, value) {
  if (!sessionToken.value) {
    const t = window.prompt('该操作需要口令：')
    if (!t) return
    sessionToken.value = t
  }
  try {
    await setErStatus(id, value, sessionToken.value)
    edgeCard.open = false
    await reloadGraph()
  } catch (e) {
    if (e?.code === 'TOKEN_INVALID') { sessionToken.value = ''; alert('口令错误') }
    else alert(`操作失败：${e?.message || e}`)
  }
}

/* ─── 重算 ─── */
const rebuilding = ref(false)
const rebuildToken = ref('')
const rebuildTokenRef = ref(null)
const rebuildAsk = reactive({ open: false, error: '', result: '' })
function openRebuild() {
  rebuildAsk.open = true; rebuildAsk.error = ''; rebuildAsk.result = ''
  rebuildToken.value = sessionToken.value || ''
  nextTick(() => rebuildTokenRef.value?.focus())
}
async function confirmRebuild() {
  if (!rebuildToken.value || rebuilding.value) return
  rebuilding.value = true; rebuildAsk.error = ''; rebuildAsk.result = ''
  try {
    const r = await erRebuild(props.env, rebuildToken.value)
    sessionToken.value = rebuildToken.value
    rebuildAsk.result = `完成：扫描 ${r.scannedTables} 表，推断 ${r.inferred} 关系（高 ${r.high} / 中 ${r.medium} / 低 ${r.low}），清理失效 ${r.deletedStale}`
    // 重算完自动展示：已选中心表则刷新，否则自动选最有料的表
    if (centerTable.value) await reloadGraph()
    else await autoSelectFirstTable()
  } catch (e) {
    if (e?.code === 'TOKEN_INVALID') rebuildAsk.error = '口令错误，请重新输入'
    else rebuildAsk.error = `重算失败：${e?.message || e}`
  } finally {
    rebuilding.value = false
  }
}

/* ─── 导出 ─── */
async function doExport() {
  try {
    await exportErRelations(props.env, 'HIGH')
  } catch (e) {
    alert(`导出失败：${e?.message || e}`)
  }
}

/* ─── 文案 ─── */
function confLabel(c) { return ({ HIGH: '高', MEDIUM: '中', LOW: '低' })[c] || c }
function statusLabel(s) { return ({ AUTO: '自动推断', CONFIRMED: '已确认', IGNORED: '已忽略' })[s] || s }
</script>

<style scoped>
.er-page { display: flex; flex-direction: column; height: 100%; background: var(--bg-page, #f6f8fb); color: var(--text-primary, #14171c); overflow: hidden; }
.er-sticky { flex: none; padding: 14px 24px 10px; background: var(--bg-card, #fff); border-bottom: 1px solid var(--border-subtle, #ebeef2); }
.er-breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-secondary, #5a6172); }
.er-bc-current { color: var(--text-primary, #14171c); font-weight: 500; }
.er-header { display: flex; justify-content: space-between; align-items: center; margin: 6px 0 8px; }
.er-title { margin: 0; font-size: 18px; font-weight: 600; }
.er-actions { display: flex; align-items: center; gap: 10px; }

.er-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.er-search { position: relative; }
.er-search-input { width: 240px; padding: 6px 10px; font-size: 13px; background: var(--bg-input, #fff); color: var(--text-primary, #14171c); border: 1px solid var(--border, #d4d8dd); border-radius: 4px; outline: none; }
.er-search-input:focus { border-color: var(--text-link, #2563eb); }
.er-suggest { position: absolute; top: 36px; left: 0; width: 240px; max-height: 280px; overflow: auto; background: var(--bg-card, #fff); border: 1px solid var(--border, #d4d8dd); border-radius: 4px; box-shadow: 0 6px 20px rgba(0,0,0,.12); z-index: 50; }
.er-suggest-item { padding: 6px 10px; font-size: 12.5px; font-family: ui-monospace, Menlo, monospace; cursor: pointer; color: var(--text-primary, #14171c); }
.er-suggest-item:hover { background: var(--bg-domain-hover, #f5f7fa); }
.er-tb-label { font-size: 12.5px; color: var(--text-secondary, #5a6172); margin-left: 6px; }
.er-select { padding: 5px 8px; background: var(--bg-input, #fff); border: 1px solid var(--border, #d4d8dd); color: var(--text-primary, #14171c); border-radius: 4px; font-size: 13px; }
/* v3：固定口径标签（替代原跳数/置信度选择器）*/
.er-scope-tag { font-size: 12px; color: var(--text-secondary, #5a6172); padding: 4px 10px; background: var(--bg-domain-hover, #f5f7fa); border: 1px solid var(--border-subtle, #ebeef2); border-radius: 4px; }
.er-center-pill { margin-left: auto; font-size: 12.5px; color: var(--text-secondary, #5a6172); }
.er-center-pill code { font-family: ui-monospace, Menlo, monospace; color: var(--text-primary, #14171c); }
.er-center-stat { margin-left: 8px; opacity: .8; }

.er-btn { padding: 6px 14px; font-size: 13px; border-radius: 4px; cursor: pointer; border: 1px solid var(--border, #d4d8dd); background: var(--bg-card, #fff); color: var(--text-secondary, #5a6172); }
.er-btn:hover:not(:disabled) { background: var(--bg-domain-hover, #f5f7fa); color: var(--text-primary, #14171c); }
.er-btn:disabled { opacity: .5; cursor: not-allowed; }
.er-btn-primary { background: var(--text-link, #2563eb); color: #fff; border-color: transparent; }
.er-btn-primary:hover:not(:disabled) { background: var(--text-link-hover, #1d4ed8); }
.er-btn-ok { color: var(--text-success, #137333); border-color: var(--border-success, #b7eb8f); }
.er-btn-warn { color: var(--text-error, #cf1124); border-color: var(--border-error, #ffccc7); }

.er-canvas-wrap { flex: 1; position: relative; overflow: hidden; }
.er-state { padding: 60px 24px; text-align: center; font-size: 13.5px; color: var(--text-secondary, #5a6172); }
.er-state-err { color: var(--text-error, #cf1124); }
.er-hint { margin-top: 10px; font-size: 12px; opacity: .8; }
.er-retry { margin-left: 10px; padding: 4px 12px; border: 1px solid var(--border, #d4d8dd); background: transparent; border-radius: 4px; cursor: pointer; color: var(--text-secondary, #5a6172); }

.er-svg { width: 100%; height: 100%; cursor: grab; user-select: none; display: block; }
.er-svg:active { cursor: grabbing; }

.er-edge { stroke-width: 1.6; cursor: pointer; }
.er-edge-high   { stroke: var(--text-success, #2e9e54); }
.er-edge-medium { stroke: var(--text-warning, #c08c00); }
.er-edge-low    { stroke: var(--text-secondary, #9aa3b0); stroke-dasharray: 5 4; }
.er-edge-ignored { stroke-dasharray: 2 4; opacity: .4; }
.er-edge:hover { stroke-width: 3; }

.er-node { cursor: move; }
.er-node-box { fill: var(--bg-card, #fff); stroke: var(--border, #d4d8dd); }
.er-node-center .er-node-box { stroke: var(--text-link, #2563eb); stroke-width: 2; }
.er-node-head { fill: var(--bg-domain-hover, #eef1f5); }
.er-node-center .er-node-head { fill: var(--text-link, #2563eb); }
.er-node-title { font-size: 12px; font-weight: 600; text-anchor: middle; fill: var(--text-primary, #14171c); font-family: ui-monospace, Menlo, monospace; }
.er-node-center .er-node-title { fill: #fff; }
.er-node-col { font-size: 11px; fill: var(--text-secondary, #5a6172); font-family: ui-monospace, Menlo, monospace; }
.er-col-key { fill: var(--text-primary, #14171c); font-weight: 600; }
.er-col-fk { fill: var(--text-link, #2563eb); }

.er-edge-card { position: absolute; width: 280px; background: var(--bg-card, #fff); border: 1px solid var(--border, #d4d8dd); border-radius: 6px; box-shadow: 0 8px 28px rgba(0,0,0,.18); font-size: 12.5px; z-index: 40; }
.er-edge-card-h { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border-subtle, #ebeef2); font-weight: 600; }
.er-edge-card-x { background: transparent; border: none; font-size: 18px; cursor: pointer; color: var(--text-secondary, #5a6172); }
.er-edge-card-row { padding: 4px 12px; color: var(--text-secondary, #5a6172); }
.er-edge-card-row code, .er-edge-card-row b { color: var(--text-primary, #14171c); }
.er-edge-card-actions { display: flex; gap: 8px; padding: 8px 12px 12px; }
.er-conf-high { color: var(--text-success, #137333); }
.er-conf-medium { color: var(--text-warning, #c08c00); }
.er-conf-low { color: var(--text-secondary, #9aa3b0); }

.er-modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.er-modal { width: 420px; max-width: 90vw; background: var(--bg-card, #fff); border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,.2); }
.er-modal-h { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px 10px; border-bottom: 1px solid var(--border-subtle, #ebeef2); }
.er-modal-h h3 { margin: 0; font-size: 15px; font-weight: 600; }
.er-modal-x { background: transparent; border: none; font-size: 20px; cursor: pointer; color: var(--text-secondary, #5a6172); }
.er-modal-b { padding: 16px 18px; }
.er-modal-tip { margin: 0 0 12px; font-size: 12.5px; line-height: 1.6; color: var(--text-secondary, #5a6172); }
.er-form-row { display: flex; align-items: center; gap: 10px; }
.er-form-row label { width: 48px; font-size: 13px; color: var(--text-secondary, #5a6172); }
.er-input { flex: 1; padding: 7px 10px; font-size: 13.5px; background: var(--bg-input, #fff); color: var(--text-primary, #14171c); border: 1px solid var(--border, #d4d8dd); border-radius: 4px; outline: none; }
.er-input:focus { border-color: var(--text-link, #2563eb); }
.er-form-err { margin-top: 8px; padding: 8px 10px; background: var(--bg-error-soft, #fff1f0); color: var(--text-error, #cf1124); border: 1px solid var(--border-error, #ffccc7); border-radius: 4px; font-size: 12.5px; }
.er-form-ok { margin-top: 8px; padding: 8px 10px; background: var(--bg-success-soft, #f6ffed); color: var(--text-success, #137333); border: 1px solid var(--border-success, #b7eb8f); border-radius: 4px; font-size: 12.5px; line-height: 1.5; }
.er-modal-f { display: flex; justify-content: flex-end; gap: 10px; padding: 10px 18px 14px; border-top: 1px solid var(--border-subtle, #ebeef2); }

/* dark 主题：状态色亮一档 */
[data-theme="dark"] .er-node-head { fill: var(--bg-domain-hover-dark, #1f2733); }
[data-theme="dark"] .er-edge-high   { stroke: var(--text-success-dark, #6ec78a); }
[data-theme="dark"] .er-edge-medium { stroke: var(--text-warning-dark, #f5c062); }
[data-theme="dark"] .er-modal-mask { background: rgba(0,0,0,.6); }
[data-theme="dark"] .er-form-err { background: var(--bg-error-soft-dark, #3d1f1f); border-color: var(--border-error-dark, #6b3030); color: var(--text-error-dark, #ff7a7e); }
[data-theme="dark"] .er-form-ok { background: var(--bg-success-soft-dark, #1e3320); border-color: var(--border-success-dark, #2f5a32); color: var(--text-success-dark, #6ec78a); }
[data-theme="dark"] .er-btn-primary { background: var(--text-link-dark, #60a5fa); color: #0b1220; }
</style>
