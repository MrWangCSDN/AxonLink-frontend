<template>
  <aside class="cis">
    <nav class="cis-nav" aria-label="分析功能导航">
      <!-- 交易链路（对齐 Make SideNav.tsx） -->
      <button type="button" class="cis-section-hd" @click="chainOpen = !chainOpen">
        <span v-if="currentPage === 'chain'" class="cis-section-hd-bar" :style="barGradient('#0b70db')" />
        <span class="cis-section-hd-ico-wrap" :class="{ on: currentPage === 'chain' }" style="--accent: #0b70db">
          <IconNetwork class="cis-section-hd-ico" />
        </span>
        <span class="cis-section-hd-label" :class="{ on: currentPage === 'chain' }" style="--accent: #0b70db">交易链路</span>
        <span v-if="currentPage === 'chain'" class="cis-pulse-wrap" aria-hidden="true">
          <span class="cis-pulse-ring" style="--accent: #0b70db" />
          <span class="cis-pulse-dot" style="--accent: #0b70db" />
        </span>
        <IconChevronDown class="cis-section-hd-chev" :class="{ collapsed: !chainOpen }" />
      </button>

      <transition
        name="cis-collapse"
        @before-enter="onCollapseBeforeEnter"
        @enter="onCollapseEnter"
        @after-enter="onCollapseAfterEnter"
        @before-leave="onCollapseBeforeLeave"
        @leave="onCollapseLeave"
      >
      <div v-show="chainOpen" class="cis-block cis-block-sub" :class="{ 'is-section-on': currentPage === 'chain' }">
        <button
          v-for="d in domains"
          :key="d.id"
          type="button"
          class="cis-domain"
          :class="{ active: currentPage === 'chain' && activeDomainId === d.id }"
          :style="domainRowStyle(d)"
          @click="$emit('selectDomain', d)"
        >
          <span
            v-if="currentPage === 'chain' && activeDomainId === d.id"
            class="cis-domain-bar"
            :style="{ background: domainColor(d.id) }"
          />
          <span class="cis-domain-ico-wrap" :style="domainIcoWrapStyle(d)">
            <component :is="domainLucideIcon(d)" />
          </span>
          <span class="cis-domain-label" :style="domainLabelStyle(d)">{{ d.name }}</span>
          <span class="cis-domain-badge" :style="domainBadgeStyle(d)">
            <span class="cis-domain-badge-txt">{{ domainCount(d) }}</span>
          </span>
        </button>
      </div>
      </transition>

      <div class="cis-sep-dashed" role="presentation" />

      <button type="button" class="cis-section-hd" @click="impactOpen = !impactOpen">
        <span v-if="currentPage === 'impact'" class="cis-section-hd-bar" :style="barGradient(IMPACT_SECTION_ACCENT)" />
        <span class="cis-section-hd-ico-wrap" :class="{ on: currentPage === 'impact' }" :style="{ '--accent': IMPACT_SECTION_ACCENT }">
          <IconGitBranch class="cis-section-hd-ico" />
        </span>
        <span class="cis-section-hd-label" :class="{ on: currentPage === 'impact' }" :style="{ '--accent': IMPACT_SECTION_ACCENT }">影响分析</span>
        <span v-if="currentPage === 'impact'" class="cis-pulse-wrap" aria-hidden="true">
          <span class="cis-pulse-ring" :style="{ '--accent': IMPACT_SECTION_ACCENT }" />
          <span class="cis-pulse-dot" :style="{ '--accent': IMPACT_SECTION_ACCENT }" />
        </span>
        <IconChevronDown class="cis-section-hd-chev" :class="{ collapsed: !impactOpen }" />
      </button>

      <transition
        name="cis-collapse"
        @before-enter="onCollapseBeforeEnter"
        @enter="onCollapseEnter"
        @after-enter="onCollapseAfterEnter"
        @before-leave="onCollapseBeforeLeave"
        @leave="onCollapseLeave"
      >
      <div v-show="impactOpen" class="cis-block cis-block-sub" :class="{ 'is-section-on': currentPage === 'impact' }">
        <button
          v-for="m in impactMenu"
          :key="m.key"
          type="button"
          class="cis-impact"
          :class="{ active: currentPage === 'impact' && impactMode === m.key }"
          :style="impactRowStyle(m)"
          @click="$emit('selectImpactMode', m.key)"
        >
          <span
            v-if="currentPage === 'impact' && impactMode === m.key"
            class="cis-impact-bar"
            :style="impactBarGradient(m.color)"
          />
          <span class="cis-impact-ico-wrap" :style="impactIcoWrapStyle(m)">
            <component :is="impactIconMap[m.key]" :style="{ color: impactIconColor(m) }" />
          </span>
          <div class="cis-impact-txt">
            <div class="cis-impact-title" :style="impactTitleStyle(m)">{{ m.label }}</div>
            <div class="cis-impact-desc" :style="impactDescStyle(m)">{{ m.desc }}</div>
          </div>
          <span class="cis-impact-badge" :class="{ active: impactActive(m) }" :style="impactBadgeStyle(m)">
            <span class="cis-impact-badge-txt">{{ impactCount(m.key) }}</span>
          </span>
        </button>
      </div>
      </transition>

      <div class="cis-sep-dashed" role="presentation" />

      <!-- ══════════ 第 3 大模块：SQL 巡检 ══════════ -->
      <button type="button" class="cis-section-hd" @click="diiOpen = !diiOpen">
        <span v-if="isDiiPage" class="cis-section-hd-bar" :style="barGradient(DII_SECTION_ACCENT)" />
        <span class="cis-section-hd-ico-wrap" :class="{ on: isDiiPage }" :style="{ '--accent': DII_SECTION_ACCENT }">
          <IconDatabase class="cis-section-hd-ico" />
        </span>
        <span class="cis-section-hd-label" :class="{ on: isDiiPage }" :style="{ '--accent': DII_SECTION_ACCENT }">SQL 巡检</span>
        <span v-if="isDiiPage" class="cis-pulse-wrap" aria-hidden="true">
          <span class="cis-pulse-ring" :style="{ '--accent': DII_SECTION_ACCENT }" />
          <span class="cis-pulse-dot" :style="{ '--accent': DII_SECTION_ACCENT }" />
        </span>
        <IconChevronDown class="cis-section-hd-chev" :class="{ collapsed: !diiOpen }" />
      </button>

      <transition
        name="cis-collapse"
        @before-enter="onCollapseBeforeEnter"
        @enter="onCollapseEnter"
        @after-enter="onCollapseAfterEnter"
        @before-leave="onCollapseBeforeLeave"
        @leave="onCollapseLeave"
      >
      <div v-show="diiOpen" class="cis-block cis-block-sub" :class="{ 'is-section-on': isDiiPage }">
        <button
          v-for="m in diiMenu"
          :key="m.key"
          type="button"
          class="cis-impact"
          :class="{ active: currentPage === m.key }"
          :style="diiRowStyle(m)"
          @click="$emit('selectDiiPage', m.key)"
        >
          <span
            v-if="currentPage === m.key"
            class="cis-impact-bar"
            :style="impactBarGradient(m.color)"
          />
          <span class="cis-impact-ico-wrap" :style="diiIcoWrapStyle(m)">
            <component :is="diiIconMap[m.key]" :style="{ color: diiActive(m) ? '#0b70db' : '#5e6975' }" />
          </span>
          <div class="cis-impact-txt">
            <div class="cis-impact-title" :style="diiTitleStyle(m)">{{ m.label }}</div>
            <div class="cis-impact-desc" :style="diiDescStyle(m)">{{ m.desc }}</div>
          </div>
        </button>
      </div>
      </transition>

      <div class="cis-sep-dashed" role="presentation" />

      <!-- ══════════ 第 4 大模块：代码提交（与 SQL 巡检 / 影响分析 平级） ══════════ -->
      <button type="button" class="cis-section-hd" @click="codeOpen = !codeOpen">
        <span v-if="isCodePage" class="cis-section-hd-bar" :style="barGradient(CODE_SECTION_ACCENT)" />
        <span class="cis-section-hd-ico-wrap" :class="{ on: isCodePage }" :style="{ '--accent': CODE_SECTION_ACCENT }">
          <IconCodeDash class="cis-section-hd-ico" />
        </span>
        <span class="cis-section-hd-label" :class="{ on: isCodePage }" :style="{ '--accent': CODE_SECTION_ACCENT }">代码提交</span>
        <span v-if="isCodePage" class="cis-pulse-wrap" aria-hidden="true">
          <span class="cis-pulse-ring" :style="{ '--accent': CODE_SECTION_ACCENT }" />
          <span class="cis-pulse-dot" :style="{ '--accent': CODE_SECTION_ACCENT }" />
        </span>
        <IconChevronDown class="cis-section-hd-chev" :class="{ collapsed: !codeOpen }" />
      </button>

      <transition
        name="cis-collapse"
        @before-enter="onCollapseBeforeEnter"
        @enter="onCollapseEnter"
        @after-enter="onCollapseAfterEnter"
        @before-leave="onCollapseBeforeLeave"
        @leave="onCollapseLeave"
      >
      <div v-show="codeOpen" class="cis-block cis-block-sub" :class="{ 'is-section-on': isCodePage }">
        <button
          v-for="m in codeMenu"
          :key="m.key"
          type="button"
          class="cis-impact"
          :class="{ active: currentPage === m.key }"
          :style="diiRowStyle(m)"
          @click="$emit('selectCodePage', m.key)"
        >
          <span
            v-if="currentPage === m.key"
            class="cis-impact-bar"
            :style="impactBarGradient(m.color)"
          />
          <span class="cis-impact-ico-wrap" :style="diiIcoWrapStyle(m)">
            <component :is="codeIconMap[m.key]" :style="{ color: diiActive(m) ? '#0b70db' : '#5e6975' }" />
          </span>
          <div class="cis-impact-txt">
            <div class="cis-impact-title" :style="diiTitleStyle(m)">{{ m.label }}</div>
            <div class="cis-impact-desc" :style="diiDescStyle(m)">{{ m.desc }}</div>
          </div>
        </button>
      </div>
      </transition>
    </nav>

    <footer class="cis-foot">
      <div class="cis-foot-stats">
        <div class="cis-foot-stat" style="--c: #14171c">
          <span class="cis-foot-stat-val">{{ domains.length }}</span>
          <span class="cis-foot-stat-lbl">领域</span>
        </div>
        <div class="cis-foot-stat" style="--c: #14171c">
          <span class="cis-foot-stat-val">{{ totalTransactions }}</span>
          <span class="cis-foot-stat-lbl">交易</span>
        </div>
        <div class="cis-foot-stat" style="--c: #14171c">
          <span class="cis-foot-stat-val">{{ totalImpactCount }}</span>
          <span class="cis-foot-stat-lbl">分析数</span>
        </div>
      </div>
      <div class="cis-foot-status" :class="{ err: systemStats.status === 'error' }">
        <!-- 连接状态指示器：成功时双环 pulse 动效；错误时静态红点 -->
        <span class="cis-foot-pulse" aria-hidden="true">
          <span class="cis-foot-pulse-ring"></span>
          <span class="cis-foot-pulse-ring cis-foot-pulse-ring-2"></span>
          <span class="cis-foot-pulse-dot"></span>
        </span>
        <span class="cis-foot-status-txt">{{ systemStats.statusText }}</span>
        <span class="cis-foot-ver">v2.1</span>
      </div>
    </footer>
  </aside>
</template>

<script setup>
import { computed, h, ref } from 'vue'

const props = defineProps({
  domains: { type: Array, required: true },
  activeDomainId: { type: String, default: '' },
  systemStats: {
    type: Object,
    default: () => ({ totalDomains: 0, totalTransactions: 0, status: 'normal', statusText: '系统运行正常' }),
  },
  totalTransactions: { type: Number, default: 0 },
  impactStats: {
    type: Object,
    default: () => ({ tableCount: 0, componentCount: 0, serviceCount: 0 }),
  },
  currentPage: { type: String, default: 'chain' },
  impactMode: { type: String, default: 'table' },
})

defineEmits(['selectDomain', 'selectImpactMode', 'selectDiiPage', 'selectCodePage'])

const chainOpen = ref(true)
const impactOpen = ref(true)
const diiOpen = ref(true)
const codeOpen = ref(true)
// 各分区的 accent 统一为 Sourcegraph 蓝；不再每区一个颜色
const IMPACT_SECTION_ACCENT = '#0b70db'
const DII_SECTION_ACCENT = '#0b70db'
const CODE_SECTION_ACCENT = '#0b70db'

// 当 currentPage 命中 dii-* 任意页时视为 DAO 模块激活
const isDiiPage = computed(() => (props.currentPage || '').startsWith('dii-'))
// 代码提交分区激活判定
const isCodePage = computed(() => props.currentPage === 'code-dashboard')

/* ── 子菜单展开/收起动画 hooks ──
   通过 JS 显式设置 height 到 scrollHeight，让 transition 在精确高度间过渡，
   避免 max-height 估算导致的"启动迟滞"或不顺滑。
   流程：
     展开：height: 0 → height: scrollHeight px → height: '' (auto，让后续布局响应)
     收起：先把 height 锁到 scrollHeight px → 再降到 0 触发过渡 */
function onCollapseBeforeEnter(el) {
  el.style.height = '0'
  el.style.opacity = '0'
}
function onCollapseEnter(el, done) {
  // 强制读 scrollHeight 让浏览器先 layout，再过渡
  // eslint-disable-next-line no-unused-expressions
  el.offsetHeight
  el.style.height = el.scrollHeight + 'px'
  el.style.opacity = '1'
  el.addEventListener('transitionend', done, { once: true })
}
function onCollapseAfterEnter(el) {
  el.style.height = ''
  el.style.opacity = ''
}
function onCollapseBeforeLeave(el) {
  el.style.height = el.scrollHeight + 'px'
  el.style.opacity = '1'
  // 同上，先 layout 一帧再触发过渡
  // eslint-disable-next-line no-unused-expressions
  el.offsetHeight
}
function onCollapseLeave(el, done) {
  el.style.height = '0'
  el.style.opacity = '0'
  el.addEventListener('transitionend', done, { once: true })
}

const DOMAIN_COLORS = {
  common: '#1890FF',
  loan: '#52C41A',
  deposit: '#FA8C16',
  settlement: '#722ED1',
  public: '#1890FF',
  ap: '#1890FF',
  dept: '#12B886',
  unvr: '#228BE6',
  stmt: '#F76707',
  medu: '#D6336C',
  inbu: '#E67700',
  aggr: '#7950F2',
}

function domainColor(id) {
  return DOMAIN_COLORS[id] || '#1890FF'
}

function domainCount(d) {
  return d.count ?? d.txCount ?? 0
}

function domainIconKey(d) {
  if (d.icon) return d.icon
  const id = d.id
  if (id === 'common' || id === 'public' || id === 'ap') return 'Globe'
  if (id === 'dept') return 'Building2'
  if (id === 'loan' || id === 'deposit') return 'Wallet'
  if (id === 'settlement') return 'ArrowLeftRight'
  return 'Globe'
}

function barGradient(accent) {
  return { background: `linear-gradient(180deg, ${accent}, ${accent}90)` }
}

function impactBarGradient() {
  // Sourcegraph 风：选中态左侧色条统一蓝，不再每项独色
  return { background: 'linear-gradient(180deg, #0b70db, #0b70db80)' }
}

function domainActive(d) {
  return props.currentPage === 'chain' && props.activeDomainId === d.id
}

/*
 * 子菜单视觉与"影响分析 / SQL 巡检"完全统一：
 *   - 不再用 domain 各自的色（橙/绿/蓝/紫），全部走 .cis-block-sub 通用样式（蓝色 accent）
 *   - 这里仅返回空对象，让 CSS 规则接管 hover / active / 文字色
 *   - 图标 / badge / 左侧 bar 已在 .cis-block-sub 里 display:none 隐掉，无需再算
 */
function domainRowStyle() { return {} }
function domainIcoWrapStyle() { return {} }
function domainLabelStyle() { return {} }
function domainBadgeStyle() { return {} }

function impactActive(m) {
  return props.currentPage === 'impact' && props.impactMode === m.key
}

/* ── 影响分析子菜单：与 SQL 巡检统一为"默认 / 选中"两态，单色 accent ── */
const IMPACT_MENU_ACCENT = '#0b70db'

function impactRowStyle(m) {
  const on = impactActive(m)
  return on
    ? { background: '#e8f1fd', borderColor: '#c2dbf3', boxShadow: 'none' }
    : { background: 'transparent', borderColor: 'transparent', boxShadow: 'none' }
}

function impactIcoWrapStyle(m) {
  const on = impactActive(m)
  return on
    ? { background: '#ffffff', borderColor: '#c2dbf3', color: IMPACT_MENU_ACCENT, boxShadow: 'none' }
    : { background: '#f1f3f5', borderColor: '#e1e5eb', color: '#5e6975', boxShadow: 'none' }
}

function impactTitleStyle(m) {
  const on = impactActive(m)
  return {
    fontWeight: on ? 600 : 500,
    color: on ? IMPACT_MENU_ACCENT : '#14171c',
  }
}

function impactDescStyle(m) {
  const on = impactActive(m)
  return { color: on ? '#0859a8' : '#8990a0' }
}

function impactBadgeStyle(m) {
  const on = impactActive(m)
  return on
    ? { background: IMPACT_MENU_ACCENT, borderColor: 'transparent', color: '#ffffff' }
    : { background: '#f1f3f5', borderColor: 'transparent', color: '#5e6975' }
}

const IconNetwork = {
  name: 'IconNetwork',
  setup() {
    return () =>
      h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        h('circle', { cx: 5, cy: 5, r: 2.5 }),
        h('circle', { cx: 19, cy: 5, r: 2.5 }),
        h('circle', { cx: 12, cy: 19, r: 2.5 }),
        h('path', { d: 'M7 6.5l4 10M17 6.5l-4 10M8 5h8' }),
      ])
  },
}

const IconGitBranch = {
  name: 'IconGitBranch',
  setup() {
    return () =>
      h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }, [
        h('path', { d: 'M6 3v12M6 15a3 3 0 1 0 3 3M18 9a3 3 0 1 0-3-3M6 9h12' }),
      ])
  },
}

const IconChevronDown = {
  name: 'IconChevronDown',
  props: { class: [String, Array, Object] },
  setup(p) {
    return () =>
      h('svg', { class: p.class, width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: '#C0C4CC', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        h('path', { d: 'm6 9 6 6 6-6' }),
      ])
  },
}

const IconGlobe = iconLucide(
  'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10',
  14
)
const IconBuilding2 = iconLucide(
  'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4',
  14
)
const IconWallet = iconLucide(
  'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1zM16 12h.01',
  14
)
const IconArrowLeftRight = iconLucide('M8 3 4 7l4 4M16 21l4-4-4-4M4 7h16M4 17h16', 14)

const IconDatabase = iconLucide(
  'M12 3C7 3 4 4.5 4 6v12c0 1.5 3 3 8 3s8-1.5 8-3V6c0-1.5-3-3-8-3Z M4 10c0 1.5 3 3 8 3s8-1.5 8-3 M4 14c0 1.5 3 3 8 3s8-1.5 8-3',
  15
)
const IconCpu = iconLucide(
  'M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2 M9 9h6v6H9z',
  15
)
const IconSettings2 = iconLucide(
  'M20 7h-9M14 17H5M17 21l3-3-3-3M7 7l-3-3 3-3',
  15
)

const IconActivity = {
  name: 'IconActivity',
  props: { class: String },
  setup(p) {
    return () =>
      h('svg', { class: p.class, width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        h('path', { d: 'M22 12h-4l-3 9L9 3l-3 9H2' }),
      ])
  },
}

function iconLucide(d, size) {
  return {
    name: 'LucideIcon',
    setup() {
      return () =>
        h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
          h('path', { d }),
        ])
    },
  }
}

const DOMAIN_LUCIDE = {
  Globe: IconGlobe,
  Building2: IconBuilding2,
  Wallet: IconWallet,
  ArrowLeftRight: IconArrowLeftRight,
}

function domainLucideIcon(d) {
  const key = domainIconKey(d)
  return DOMAIN_LUCIDE[key] || IconGlobe
}

const impactIconMap = {
  table: IconDatabase,
  component: IconCpu,
  service: IconSettings2,
}

const impactMenu = [
  { key: 'table', label: '表级分析', desc: '数据表影响溯源', color: '#13C2C2', bg: '#E6FFFB' },
  { key: 'component', label: '构件分析', desc: '构件影响溯源', color: '#FA8C16', bg: '#FFF7E6' },
  { key: 'service', label: '服务分析', desc: '服务影响溯源', color: '#1890FF', bg: '#E6F7FF' },
]

// ══════════ SQL 巡检 · 子页菜单 ══════════
// 配色统一为 Sourcegraph 风：菜单项只有"默认 / 选中"两态，所有项共享同一个 accent
// 单独的 color 字段保留是为了向后兼容，但 diiRowStyle / diiIcoWrapStyle 已不读它
const DII_MENU_ACCENT = '#0b70db'
const diiMenu = [
  { key: 'dii-dashboard',     label: '概览仪表盘',     desc: '总览 · 评级分布' },
  { key: 'dii-tasks',         label: '巡检任务',       desc: '批量巡检进度' },
  { key: 'dii-sqls',          label: 'SQL 维度分析',   desc: '逐条 SQL 详情' },
  { key: 'dii-table-advice',  label: 'TABLE 维度分析', desc: 'DBA 聚合视图' },
  { key: 'dii-sql-pool',      label: 'SQL 池',         desc: 'Excel 导入的外部 SQL 库' },
]

// ══════════ 代码提交 · 独立分区（与 SQL 巡检 / 影响分析 平级）子页菜单 ══════════
const codeMenu = [
  { key: 'code-dashboard', label: '代码提交大屏', desc: '工程/作者/领域 占比' },
]

const IconDatabaseLg = iconLucide(
  'M12 3C7 3 4 4.5 4 6v12c0 1.5 3 3 8 3s8-1.5 8-3V6c0-1.5-3-3-8-3Z M4 10c0 1.5 3 3 8 3s8-1.5 8-3 M4 14c0 1.5 3 3 8 3s8-1.5 8-3',
  14
)
const IconGauge = iconLucide('M12 14l4-4M3.5 16a9 9 0 1 1 17 0', 15)
const IconList = iconLucide('M8 6h13M8 12h13M8 18h13 M3 6h.01M3 12h.01M3 18h.01', 15)
const IconClipboard = iconLucide('M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z M7 6v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6', 15)
const IconTable = iconLucide('M3 6h18M3 12h18M3 18h18 M9 3v18M15 3v18', 15)
const IconCodeDash = iconLucide('M9 7l-4 5 4 5 M15 7l4 5-4 5', 15)
const IconUpload = iconLucide('M12 3v12 M7 8l5-5 5 5 M3 19h18', 15)

const diiIconMap = {
  'dii-dashboard':    IconGauge,
  'dii-sqls':         IconList,
  'dii-tasks':        IconClipboard,
  'dii-table-advice': IconTable,
  'dii-sql-pool':     IconUpload,
}

const codeIconMap = {
  'code-dashboard': IconCodeDash,
}

function diiActive(m) { return props.currentPage === m.key }
function diiRowStyle(m) {
  const on = diiActive(m)
  // 选中：浅蓝底 + accent 边；默认：透明无边
  return on
    ? { background: '#e8f1fd', borderColor: '#c2dbf3' }
    : { background: 'transparent', borderColor: 'transparent' }
}
function diiIcoWrapStyle(m) {
  const on = diiActive(m)
  // 图标方块：选中态 accent 蓝；默认态中性灰
  return on
    ? { background: '#ffffff', borderColor: '#c2dbf3', color: DII_MENU_ACCENT }
    : { background: '#f1f3f5', borderColor: '#e1e5eb', color: '#5e6975' }
}
function diiTitleStyle(m) {
  const on = diiActive(m)
  return { fontWeight: on ? 600 : 500, color: on ? DII_MENU_ACCENT : '#14171c' }
}
function diiDescStyle(m) {
  const on = diiActive(m)
  return { color: on ? '#0859a8' : '#8990a0' }
}

function impactIconColor(m) {
  // 二态着色：选中蓝、默认灰，不再读 m.color
  return impactActive(m) ? '#0b70db' : '#5e6975'
}

function impactCount(key) {
  if (key === 'table') return props.impactStats?.tableCount ?? 0
  if (key === 'component') return props.impactStats?.componentCount ?? 0
  return props.impactStats?.serviceCount ?? 0
}

const totalImpactCount = computed(() => {
  const tableCount = Number(props.impactStats?.tableCount ?? 0)
  const componentCount = Number(props.impactStats?.componentCount ?? 0)
  const serviceCount = Number(props.impactStats?.serviceCount ?? 0)
  return tableCount + componentCount + serviceCount
})
</script>

<style scoped>
/* Figma Make / SideNav.tsx */
.cis {
  width: 240px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
  border-right: 1px solid #eaecf0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

.cis-nav {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0 16px;
}

.cis-section-hd {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 44px;
  padding: 0 14px;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: background 0.15s;
}

.cis-section-hd:hover {
  background: #f5f7fa;
}

.cis-section-hd-bar {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 3px 3px 0;
}

.cis-section-hd-ico-wrap {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  background: #f0f2f5;
  border: 1px solid #e8ecf0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
  transition: all 0.2s;
}

.cis-section-hd-ico-wrap.on {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent) 21%, transparent);
  color: var(--accent);
}

.cis-section-hd-ico {
  display: block;
}

.cis-section-hd-label {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: 0.3px;
  transition: color 0.15s;
}

.cis-section-hd-label.on {
  color: var(--accent);
}

.cis-pulse-wrap {
  position: relative;
  width: 8px;
  height: 8px;
  flex-shrink: 0;
}

.cis-pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.3;
  animation: cis-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.cis-pulse-dot {
  position: absolute;
  inset: 1px;
  border-radius: 50%;
  background: var(--accent);
}

@keyframes cis-ping {
  75%,
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.cis-section-hd-chev {
  flex-shrink: 0;
  transition: transform 0.25s;
}

.cis-section-hd-chev.collapsed {
  transform: rotate(-90deg);
}

.cis-block {
  padding: 2px 0 4px;
}

/* 子菜单展开/收起动画：350ms cubic-bezier 平滑曲线 + 高度 + 透明度联动 */
.cis-collapse-enter-active,
.cis-collapse-leave-active {
  overflow: hidden;
  transition: height 0.35s cubic-bezier(0.22, 0.61, 0.36, 1),
              opacity 0.25s ease;
  will-change: height, opacity;
}
/* 配合 chevron 用稍慢的旋转，与展开节奏对齐 */
.cis-section-hd-chev {
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) !important;
}

/* ════════════ Sourcegraph docs 风子菜单 ════════════
   - 纯文字（隐图标 + 隐描述）
   - 缩进 + 单根 1px 垂直 guide 线（无横向连接线）
   - 选中态：1px 描边轮廓 + 同色文字，无填充
   - 紧凑：行高 30px，字号 12px */
.cis-block-sub {
  position: relative;
  margin-left: 18px;          /* 缩进出 guide 线 */
  margin-right: 8px;
  padding: 2px 0 4px;
}
.cis-block-sub::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #e1e5eb;
  transition: background-color 0.15s ease;
}
/* section 激活时不再点亮整条 guide（Sourcegraph docs 也是恒灰），
   选中信号统一交给"描边轮廓"承担 */

/* 子项：纯文字按钮，无图标无描述（同时覆盖 cis-impact 和 cis-domain）。
   用 !important 覆盖 .cis-domain base 样式（margin/width/border-radius 不为 0），
   避免交易链路子菜单出现卡片化背景 / 圆角描边，跟 SQL 巡检子菜单视觉完全一致。 */
.cis-block-sub .cis-impact,
.cis-block-sub .cis-domain {
  width: 100% !important;
  margin: 0 !important;
  padding: 0 12px !important;            /* 文字距 guide 线 12px */
  height: 30px !important;
  border-radius: 4px !important;
  border: 1px solid transparent !important;
  background: transparent !important;
  box-shadow: none !important;
  gap: 0 !important;
}
.cis-block-sub .cis-impact:hover:not(.active),
.cis-block-sub .cis-domain:hover:not(.active) {
  background: #f3f5f8 !important;
  border-color: transparent !important;
}
/* 选中态：移除四周描边，统一用左侧 3px 竖条（light = 蓝 / dark = 红） */
.cis-block-sub .cis-impact.active,
.cis-block-sub .cis-domain.active {
  background: transparent !important;
  border-color: transparent !important;
}
.cis-block-sub .cis-impact.active::before,
.cis-block-sub .cis-domain.active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 4px;
  bottom: 4px;
  width: 3px;
  background: #0b70db;     /* light 模式蓝 */
  border-radius: 0 1px 1px 0;
  pointer-events: none;
}

/* 隐藏图标和描述，只留标题 */
.cis-block-sub .cis-impact-ico-wrap,
.cis-block-sub .cis-impact-desc,
.cis-block-sub .cis-impact-bar,
.cis-block-sub .cis-domain-ico-wrap,
.cis-block-sub .cis-domain-bar {
  display: none;
}

/* 标题：12px，选中时变蓝（同 border 色） */
.cis-block-sub .cis-impact-title,
.cis-block-sub .cis-domain-label {
  font-size: 12px;
  font-weight: 400;
  color: #5e6975;
}
.cis-block-sub .cis-impact.active .cis-impact-title,
.cis-block-sub .cis-domain.active .cis-domain-label {
  color: #0b70db;
  font-weight: 500;
}

/* 隐掉交易链路 / 影响分析 子菜单后面的数量 badge（按需求不展示具体数量） */
.cis-domain-badge,
.cis-impact-badge {
  display: none !important;
}

/* 右侧 badge（数字徽章）：缩小，跟 SG docs 一样靠右 */
.cis-block-sub .cis-impact-badge {
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: 8px;
  background: #f1f3f5;
  border: none;
}
.cis-block-sub .cis-impact-badge-txt {
  font-size: 10px;
  color: #8990a0;
}
.cis-block-sub .cis-impact.active .cis-impact-badge {
  background: transparent;
  border: 1px solid #c2dbf3;
}
.cis-block-sub .cis-impact.active .cis-impact-badge-txt {
  color: #0b70db;
}

.cis-domain {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 20px);
  margin: 1px 10px;
  padding: 0 10px;
  height: 42px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: all 0.15s;
}

.cis-domain:hover:not(.active) {
  background: #f5f7fa !important;
  border-color: #e8ecf0 !important;
}

.cis-domain-bar {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
}

.cis-domain-ico-wrap {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  flex-shrink: 0;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.cis-domain-ico-wrap :deep(svg) {
  display: block;
}

.cis-domain-label {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.15s;
}

.cis-domain-badge {
  min-width: 22px;
  height: 20px;
  border-radius: 10px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.cis-domain-badge-txt {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.cis-domain:not(.active) .cis-domain-badge-txt {
  color: #8c8c8c;
}

.cis-domain.active .cis-domain-badge-txt {
  color: #fff;
}

.cis-sep-dashed {
  margin: 8px 16px;
  border-top: 1px dashed #eaecf0;
}

.cis-impact {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 20px);
  margin: 1px 10px;
  padding: 0 10px;
  height: 52px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: all 0.18s;
}

.cis-impact:hover:not(.active) {
  background: #f5f7fa !important;
  border-color: #e8ecf0 !important;
  box-shadow: none !important;
}

.cis-impact-bar {
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 2px 2px 0;
}

.cis-impact-ico-wrap {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  flex-shrink: 0;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s;
}

.cis-impact-ico-wrap :deep(svg) {
  display: block;
}

.cis-impact-txt {
  flex: 1;
  min-width: 0;
}

.cis-impact-title {
  font-size: 13px;
  line-height: 1.3;
  transition: color 0.15s;
}

.cis-impact-desc {
  font-size: 11px;
  margin-top: 2px;
  letter-spacing: 0.1px;
}

.cis-impact-badge {
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.18s;
}

.cis-impact-badge-txt {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: #8c8c8c;
}

.cis-impact-badge.active .cis-impact-badge-txt,
.cis-impact.active .cis-impact-badge-txt {
  color: inherit;
}

.cis-foot {
  padding: 12px 16px 14px;
  border-top: 1px solid #eaecf0;
  background: #fff;
  flex-shrink: 0;
}

.cis-foot-stats {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.cis-foot-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 7px 4px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--c) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 10%, transparent);
}

.cis-foot-stat-val {
  font-size: 16px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--c);
}

.cis-foot-stat-lbl {
  font-size: 10px;
  color: #a0a3af;
  margin-top: 3px;
  font-weight: 500;
}

/* 连接状态条：默认 SG 蓝色（连接成功），错误态切红 */
.cis-foot-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: #e8f1fd;
  border: 1px solid #c2dbf3;
  border-radius: 6px;
}

.cis-foot-status.err {
  background: #fdecee;
  border-color: #f0c2c5;
}

.cis-foot-status-txt {
  font-size: 11px;
  color: #0859a8;
  font-weight: 500;
  flex: 1;
}

.cis-foot-status.err .cis-foot-status-txt {
  color: #cf1124;
}

.cis-foot-ver {
  font-size: 10px;
  color: #0b70db;
  font-family: ui-monospace, monospace;
  font-weight: 500;
}

.cis-foot-status.err .cis-foot-ver {
  color: #cf1124;
}

/* 双环 pulse 动效：模拟"心跳/在线"信号 */
.cis-foot-pulse {
  position: relative;
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.cis-foot-pulse-dot {
  position: relative;
  z-index: 2;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0b70db;
  box-shadow: 0 0 0 2px #ffffff;
}
.cis-foot-pulse-ring,
.cis-foot-pulse-ring-2 {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0b70db;
  opacity: 0.55;
  transform: translate(-50%, -50%);
  animation: cis-foot-pulse 1.6s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
}
.cis-foot-pulse-ring-2 { animation-delay: 0.8s; }

@keyframes cis-foot-pulse {
  0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.55; }
  80%  { transform: translate(-50%, -50%) scale(3.6); opacity: 0; }
  100% { transform: translate(-50%, -50%) scale(3.6); opacity: 0; }
}

/* 错误态：取消动画，红色静态 */
.cis-foot-status.err .cis-foot-pulse-dot { background: #cf1124; }
.cis-foot-status.err .cis-foot-pulse-ring,
.cis-foot-status.err .cis-foot-pulse-ring-2 {
  background: #cf1124;
  animation: none;
  opacity: 0;
}

/* ════════════ Dark：1:1 仿 Sourcegraph docs ════════════
   - 纯黑 #000 平底
   - 隐 section header icon / 隐 pulse 动效 / 隐 section bar，纯文字 + chevron
   - 子项选中：左侧 3px 红条 + 红色文字，无 border 无 bg
   - guide 线 #2a2a2e */

/* 1. 整侧栏底色：纯黑（不要 navy 渐变，不要任何蓝调） */
[data-theme='dark'] .cis {
  background: #000 !important;
  border-color: rgba(255, 255, 255, 0.08);
}

/* 2. Section header 干净化：保留图标但暗色化，隐 pulse / 隐左 bar */
[data-theme='dark'] .cis-section-hd-bar,
[data-theme='dark'] .cis-pulse-wrap {
  display: none !important;
}
[data-theme='dark'] .cis-section-hd {
  padding: 0 14px;            /* 保留图标位置，左 padding 不变 */
}
/* Section icon 暗色：透明底 + 1px 半透白边 + 中性灰 stroke，
   选中时 border + stroke 都提亮一档（与文字白色形成层级） */
[data-theme='dark'] .cis-section-hd-ico-wrap,
[data-theme='dark'] .cis-section-hd-ico-wrap.on {
  background: transparent !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: #9b9da4 !important;
}
[data-theme='dark'] .cis-section-hd-ico-wrap.on {
  border-color: rgba(255, 255, 255, 0.20) !important;
  color: #e8e8ec !important;
}
[data-theme='dark'] .cis-section-hd:hover {
  background: rgba(255, 255, 255, 0.03) !important;
}
[data-theme='dark'] .cis-section-hd-label,
[data-theme='dark'] .cis-section-hd-label.on,
[data-theme='dark'] .cis-section-hd-label:not(.on) {
  color: #ffffff;
  font-weight: 600;
  font-size: 13px;
}
[data-theme='dark'] .cis-section-hd-chev {
  color: #6e7280;
}

[data-theme='dark'] .cis-sep-dashed {
  border-top-color: rgba(255, 255, 255, 0.06);
}

[data-theme='dark'] .cis-section-hd:hover,
[data-theme='dark'] .cis-domain:hover:not(.active),
[data-theme='dark'] .cis-impact:hover:not(.active) {
  background: var(--bg-domain-hover) !important;
}

[data-theme='dark'] .cis-section-hd-label:not(.on) {
  color: var(--text-secondary);
}

[data-theme='dark'] .cis-impact-badge {
  background: rgba(255, 255, 255, 0.08);
}

[data-theme='dark'] .cis-impact-badge-txt {
  color: #aeb4c4;
}

[data-theme='dark'] .cis-foot {
  background: var(--bg-card);
  border-color: var(--border);
}

/* ════════════ Dark 主题：Sourcegraph 风子菜单暗色适配 ════════════
   - guide 线: 浅灰 → 暗灰
   - 子项默认文字: #5e6975 → #8FA3BF（暗色下保留可读对比）
   - 子项 hover 底色: #f3f5f8 → 半透白
   - 选中态描边 + 文字仍用 SG 蓝（暗背景下蓝色穿透力够）
   - 数字 badge 在暗色下背景半透白 */
/* 子菜单分组：guide 线 #2a2a2e */
[data-theme='dark'] .cis-block-sub::before {
  background: #2a2a2e;
}

/* 子项 hover：仅微底色变化，不加边框（SG docs 鼠标悬停几乎看不出）*/
[data-theme='dark'] .cis-block-sub .cis-impact:hover:not(.active),
[data-theme='dark'] .cis-block-sub .cis-domain:hover:not(.active) {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: transparent !important;
}

/* 选中态：纯黑底 + 文字红，无 border 无填充——红色信号靠左侧 3px 红条承担 */
[data-theme='dark'] .cis-block-sub .cis-impact.active,
[data-theme='dark'] .cis-block-sub .cis-domain.active {
  background: transparent !important;
  border-color: transparent !important;
}

/* 左侧 3px 红条：盖在 guide 线上做"选中"标识（SG docs 招牌做法） */
[data-theme='dark'] .cis-block-sub .cis-impact.active::before,
[data-theme='dark'] .cis-block-sub .cis-domain.active::before {
  content: '';
  position: absolute;
  left: -1px;          /* 覆盖 guide 线那 1px 列 */
  top: 4px;
  bottom: 4px;
  width: 3px;
  background: #FF5543;
  border-radius: 0 1px 1px 0;
  pointer-events: none;
}
/* 子项文字：!important 防止任何祖先样式干扰 */
[data-theme='dark'] .cis-block-sub .cis-impact-title,
[data-theme='dark'] .cis-block-sub .cis-domain-label {
  color: #e8e8ec !important;        /* 对比 14:1 / WCAG AAA + */
  opacity: 1 !important;
}
[data-theme='dark'] .cis-block-sub .cis-impact:hover:not(.active) .cis-impact-title,
[data-theme='dark'] .cis-block-sub .cis-domain:hover:not(.active) .cis-domain-label {
  color: #ffffff !important;
}
[data-theme='dark'] .cis-block-sub .cis-impact.active .cis-impact-title,
[data-theme='dark'] .cis-block-sub .cis-domain.active .cis-domain-label {
  color: #FF5543 !important;
  font-weight: 500;
}
[data-theme='dark'] .cis-block-sub .cis-impact-badge {
  background: rgba(255, 255, 255, 0.06);
}
[data-theme='dark'] .cis-block-sub .cis-impact-badge-txt {
  color: #9b9da4;
}
[data-theme='dark'] .cis-block-sub .cis-impact.active .cis-impact-badge {
  background: transparent;
  border: 1px solid rgba(255, 85, 67, 0.4);
}
[data-theme='dark'] .cis-block-sub .cis-impact.active .cis-impact-badge-txt {
  color: #FF5543;
}

/* 底部连接状态条 + 双环动效 暗色版 */
[data-theme='dark'] .cis-foot-status {
  background: rgba(79, 124, 255, 0.10);
  border-color: rgba(79, 124, 255, 0.25);
}
[data-theme='dark'] .cis-foot-status.err {
  background: rgba(229, 72, 77, 0.12);
  border-color: rgba(229, 72, 77, 0.30);
}
[data-theme='dark'] .cis-foot-status-txt { color: #7EB8FF; }
[data-theme='dark'] .cis-foot-status.err .cis-foot-status-txt { color: #FF8A8E; }
[data-theme='dark'] .cis-foot-ver { color: #7EB8FF; }
[data-theme='dark'] .cis-foot-status.err .cis-foot-ver { color: #FF8A8E; }
[data-theme='dark'] .cis-foot-pulse-dot {
  background: #7EB8FF;
  box-shadow: 0 0 0 2px var(--bg-card);   /* 灯芯白边在暗色下改用 card 底色 */
}
[data-theme='dark'] .cis-foot-pulse-ring,
[data-theme='dark'] .cis-foot-pulse-ring-2 { background: #7EB8FF; }
[data-theme='dark'] .cis-foot-status.err .cis-foot-pulse-dot { background: #FF8A8E; }

/* 底部 KPI tile 暗色：原本 --c: #14171c 在暗色下不可读，改读暗色文字色 */
[data-theme='dark'] .cis-foot-stat {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08);
}
[data-theme='dark'] .cis-foot-stat-val { color: var(--text-primary); }
[data-theme='dark'] .cis-foot-stat-lbl { color: var(--text-faint); }

/* Section header 图标在暗色默认态：原 #f0f2f5 灰底变成半透白 */
[data-theme='dark'] .cis-section-hd-ico-wrap:not(.on) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  color: var(--text-faint);
}
</style>
