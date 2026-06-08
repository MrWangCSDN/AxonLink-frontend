<template>
  <div class="dii-page">
    <!-- 顶部 sticky 区：面包屑 + 标题 + 环境切换 -->
    <div class="dii-sticky">
      <div class="dii-breadcrumb">
        <span class="dii-bc-home">SQL 巡检</span>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M5 3.5L8.5 7L5 10.5" stroke="#C5CBD7" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="dii-bc-current">概览仪表盘</span>
      </div>

      <div class="dii-header">
        <div>
          <h2 class="dii-title">概览仪表盘</h2>
          <p class="dii-subtitle" v-if="latestTask">
            最新任务 <strong>{{ latestTask.task_no }}</strong>
            · 共 {{ fmt(latestTask.total_sqls) }} 条 SQL
            · 完成于 {{ fmtTime(latestTask.updated_at) }}
          </p>
          <p class="dii-subtitle" v-else>
            暂无已完成的巡检任务
          </p>
        </div>
        <div class="dii-header-right">
          <DiiEnvSwitcher :model-value="env" @update:model-value="$emit('update:env', $event)" />
        </div>
      </div>
    </div>

    <div class="dii-scroll">
      <!-- 加载/错误/空 三态 -->
      <div v-if="loading" class="dii-state">加载中...</div>
      <div v-else-if="errorMsg" class="dii-state dii-state-err">
        {{ errorMsg }}
        <button class="dii-retry-btn" @click="doLoad">重试</button>
      </div>
      <div v-else-if="!latestTask" class="dii-state">
        当前环境（{{ env }}）下还没有跑过批量巡检，请到「巡检任务」页手动触发一次。
      </div>

      <template v-else>
        <!-- 2x2 网格布局：宽屏左右两块，窄屏自动堆叠 -->
        <div class="dii-grid-2col">
          <!-- 第一块：按领域聚合（巡检数 / EXPLAIN 报错 / LLM 整改）多系列分组柱状图 -->
          <section class="dii-panel">
            <div class="dii-panel-head">
              <div>
                <h3 class="dii-panel-title">最新 SQL 任务分析（按领域）</h3>
                <p class="dii-panel-desc">巡检 SQL 总数 / EXPLAIN 报错 / 需整改 / 白名单申请中 / 已申请白名单</p>
              </div>
              <div class="dii-legend">
                <span class="dii-legend-item"><i class="dii-swatch dii-sw-total"></i>SQL总数</span>
                <span class="dii-legend-item"><i class="dii-swatch dii-sw-err"></i>报错</span>
                <span class="dii-legend-item"><i class="dii-swatch dii-sw-fix"></i>需整改</span>
                <span class="dii-legend-item"><i class="dii-swatch dii-sw-wl-applying"></i>白名单申请中</span>
                <span class="dii-legend-item"><i class="dii-swatch dii-sw-wl-approved"></i>已申请白名单</span>
              </div>
            </div>
            <DiiBarGroupChart
              :categories="byDomainCats"
              :series="byDomainSeries"
              :height="200"
            />
          </section>

          <!-- 第二块：整改分布（按领域 2 档）→ 横向堆叠条
               只展示 EXPLAIN 报错 + 全表扫描且 AI 判定待整改；AI 判无需整改的已过滤 -->
          <section class="dii-panel">
            <div class="dii-panel-head">
              <div>
                <h3 class="dii-panel-title">整改分布（按领域）</h3>
                <p class="dii-panel-desc">仅 EXPLAIN 报错 + 全表扫描且 AI 判定待整改（AI 判无需整改已过滤）</p>
              </div>
              <div class="dii-legend">
                <span class="dii-legend-item"><i class="dii-swatch dii-sw-error"></i>报错</span>
                <span class="dii-legend-item"><i class="dii-swatch dii-sw-fix"></i>需整改</span>
                <span class="dii-legend-item"><i class="dii-swatch dii-sw-wl-applying"></i>白名单申请中</span>
                <span class="dii-legend-item"><i class="dii-swatch dii-sw-wl-approved"></i>已申请白名单</span>
              </div>
            </div>
            <DiiHorizontalStackBar
              :categories="ratingDomainCats"
              :series="ratingDomainSeries"
            />
          </section>

          <!-- 第三块：7 天评级趋势 → 四档堆叠柱 + 领域单选切换
               组件自带面板/标题/图例/tab，直接传后端 trend7d 明细行即可 -->
          <DiiDashboardTrendChart :items="trend7d" />

          <!-- 第四块：7 天巡检任务执行时长 → 饼图（看每天耗时占比） -->
          <section class="dii-panel">
            <div class="dii-panel-head">
              <div>
                <h3 class="dii-panel-title">近 7 天巡检任务执行时长</h3>
                <p class="dii-panel-desc">每天一片，按耗时占比切分；中心是 7 天总时长（分钟）</p>
              </div>
            </div>
            <DiiPieChart
              :categories="elapsedCats"
              :series="elapsedSeries"
              center-label="7 天合计"
              value-suffix=" min"
            />
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import DiiEnvSwitcher from './widgets/DiiEnvSwitcher.vue'
import DiiBarGroupChart from './widgets/DiiBarGroupChart.vue'
import DiiHorizontalStackBar from './widgets/DiiHorizontalStackBar.vue'
import DiiPieChart from './widgets/DiiPieChart.vue'
import DiiDashboardTrendChart from './dashboard/DiiDashboardTrendChart.vue'
import { getDiiDashboard } from '../../api/daoIndex.js'

const props = defineProps({ env: { type: String, default: 'uat' } })
defineEmits(['update:env', 'goto'])

/* ─────── 数据状态 ─────── */
const loading = ref(false)
const errorMsg = ref('')
const latestTask = ref(null)
const byDomain = ref([])
const ratingByDomain = ref([])
const trend7d = ref([])
const elapsed7d = ref([])

/* ─────── 数据加载 ─────── */
async function doLoad() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await getDiiDashboard(props.env)
    latestTask.value = data?.latestTask || null
    byDomain.value = Array.isArray(data?.byDomain) ? data.byDomain : []
    ratingByDomain.value = Array.isArray(data?.ratingByDomain) ? data.ratingByDomain : []
    trend7d.value = Array.isArray(data?.trend7d) ? data.trend7d : []
    elapsed7d.value = Array.isArray(data?.elapsed7d) ? data.elapsed7d : []
  } catch (e) {
    errorMsg.value = `加载失败：${e?.message || e}`
    latestTask.value = null
  } finally {
    loading.value = false
  }
}

onMounted(doLoad)
watch(() => props.env, doLoad)

/* "其他"领域在前端展示层过滤掉（业务上不关心兜底分类，只看明确的 4 个领域） */
const filteredByDomain = computed(() =>
  byDomain.value.filter(d => d.domain !== '其他')
)
const filteredRatingByDomain = computed(() =>
  ratingByDomain.value.filter(d => d.domain !== '其他')
)

/* ─────── 第一块：按领域聚合 ─────── */
const byDomainCats = computed(() => filteredByDomain.value.map(d => d.domain))
const byDomainSeries = computed(() => [
  { name: 'SQL总数', color: 'var(--c-bar-total, #6366f1)',
    values: filteredByDomain.value.map(d => Number(d.total) || 0) },
  { name: '报错', color: '#d4380d',
    values: filteredByDomain.value.map(d => Number(d.explain_err) || 0) },
  { name: '需整改', color: '#e6a23c',
    values: filteredByDomain.value.map(d => Number(d.need_fix) || 0) },
  { name: '白名单申请中', color: '#fa8c16',
    values: filteredByDomain.value.map(d => Number(d.wl_applying) || 0) },
  { name: '已申请白名单', color: '#722ed1',
    values: filteredByDomain.value.map(d => Number(d.wl_approved) || 0) },
])

/* ─────── 第二块：整改分布按领域（4 档：报错 / 需整改 / 白名单申请中 / 已申请白名单）───────
   后端 ratingByDomain 结构 [{domain, error_count, need_fix, wl_applying, wl_approved}]
   error_count = EXPLAIN 报错；need_fix = 非报错+overall_rating=POOR+llm_fix_verdict=NEED_FIX
   wl_applying = 白名单申请中；wl_approved = 已申请（审批通过）白名单 */
const ratingDomainCats = computed(() => filteredRatingByDomain.value.map(d => d.domain))
const ratingDomainSeries = computed(() => [
  { name: '报错', color: '#d4380d',
    values: filteredRatingByDomain.value.map(d => Number(d.error_count) || 0) },
  { name: '需整改', color: '#e6a23c',
    values: filteredRatingByDomain.value.map(d => Number(d.need_fix) || 0) },
  { name: '白名单申请中', color: '#fa8c16',
    values: filteredRatingByDomain.value.map(d => Number(d.wl_applying) || 0) },
  { name: '已申请白名单', color: '#722ed1',
    values: filteredRatingByDomain.value.map(d => Number(d.wl_approved) || 0) },
])

/* ─────── 第三块：7 天评级趋势 ───────
   已迁移到自带逻辑的 DiiDashboardTrendChart 组件：
   后端 trend7d 现按 (task, domain) 返回明细行，组件内部按
   选中领域（汇总/各领域）折叠成每任务一根四档堆叠柱。
   原 trendCats/trendSeries（折线图数据）已不再需要。 */

/* ─────── 第四块：7 天执行时长 ─────── */
const elapsedCats = computed(() => elapsed7d.value.map(t => fmtDay(t.day)))
const elapsedSeries = computed(() => [
  { name: '执行时长', color: 'var(--c-bar-elapsed, #8b5cf6)',
    // 后端返回秒，前端展示分钟（保留 1 位小数）
    values: elapsed7d.value.map(t => +(((Number(t.elapsed_seconds) || 0) / 60).toFixed(1))) },
])

/* ─────── 工具函数 ─────── */
function fmt(n) {
  if (n == null) return '-'
  return Number(n).toLocaleString('en-US')
}
function fmtTime(s) {
  if (!s) return ''
  return String(s).slice(0, 16)  // '2026-04-29 01:24'
}
function fmtDay(s) {
  if (!s) return ''
  // s 可能是 'YYYY-MM-DD' 或 ISO 字符串
  return String(s).slice(5, 10)  // '04-23'
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

.dii-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.dii-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--text-primary, #14171c); }
.dii-subtitle { margin: 4px 0 0; font-size: 12.5px; color: var(--text-secondary, #5a6172); }
.dii-subtitle strong { color: var(--text-primary, #14171c); font-family: ui-monospace, monospace; }

.dii-scroll { flex: 1; overflow-y: auto; padding: 16px 24px 32px; }
.dii-state {
  text-align: center;
  padding: 64px 24px;
  color: var(--text-secondary, #5a6172);
  font-size: 13.5px;
}
.dii-state-err { color: var(--text-error, #cf1124); }
.dii-retry-btn {
  margin-left: 12px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary, #5a6172);
}

/* 2x2 网格容器：宽屏 2 列，窄屏 (<1100px) 自动单列堆叠 */
.dii-grid-2col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 1100px) {
  .dii-grid-2col {
    grid-template-columns: 1fr;
  }
}

/* 4 块面板 */
.dii-panel {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-subtle, #ebeef2);
  border-radius: 8px;
  padding: 18px 20px;
  /* margin-bottom 不再需要，gap 由 grid 容器管 */
  min-width: 0;  /* 允许 grid 子项缩小（防止柱状图溢出） */
}
.dii-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.dii-panel-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #14171c);
}
.dii-panel-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary, #5a6172);
}

/* 图例 */
.dii-legend {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary, #5a6172);
}
.dii-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.dii-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}
.dii-sw-total       { background: var(--c-bar-total, #6366f1); }
.dii-sw-err         { background: #d4380d; }
.dii-sw-fix         { background: #e6a23c; }
.dii-sw-poor        { background: #e6a23c; }
.dii-sw-error       { background: #d4380d; }
.dii-sw-elapsed     { background: var(--c-bar-elapsed, #8b5cf6); }
.dii-sw-wl-applying { background: #fa8c16; }
.dii-sw-wl-approved { background: #722ed1; }

/* dark 主题：颜色亮一档保持对比度 */
[data-theme="dark"] .dii-sw-total       { background: var(--c-bar-total-dark, #818cf8); }
[data-theme="dark"] .dii-sw-err         { background: #ff7a7e; }
[data-theme="dark"] .dii-sw-fix         { background: #f5c062; }
[data-theme="dark"] .dii-sw-poor        { background: #f5c062; }
[data-theme="dark"] .dii-sw-error       { background: #ff7a7e; }
[data-theme="dark"] .dii-sw-elapsed     { background: var(--c-bar-elapsed-dark, #a78bfa); }
[data-theme="dark"] .dii-sw-wl-applying { background: #ffa940; }
[data-theme="dark"] .dii-sw-wl-approved { background: #9254de; }
</style>
