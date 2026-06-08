<template>
  <!--
    SQL 巡检总容器：根据 currentPage 切换具体子页。
    全局共享一个 env 状态，切子页时 env 不会被重置。
  -->
  <div class="dii-main">
    <!-- 选中的二级导航对应不同子页 -->
    <DaoDashboard
      v-show="currentPage === 'dii-dashboard'"
      :env="env"
      @update:env="env = $event"
      @goto="handleGoto"
    />
    <DaoSqlList
      v-show="currentPage === 'dii-sqls'"
      :env="env"
      :filter="sqlListFilter"
      @update:env="env = $event"
      @back-to-tasks="handleBackToTasks"
      @clear-todo-filter="sqlListFilter = {}"
    />
    <!-- SQL 白名单列表：复用 DaoSqlList，传 whitelistScope='wl' 切换到白名单视图 -->
    <DaoSqlList
      v-show="currentPage === 'dii-sql-whitelist'"
      :env="env"
      :whitelist-scope="'wl'"
      @update:env="env = $event"
    />
    <DaoTaskList
      v-show="currentPage === 'dii-tasks'"
      :env="env"
      @update:env="env = $event"
      @goto-sqls="handleGotoSqlsFromTask"
      @open-task="openTaskDetail"
    />
    <DaoTableAdvice
      v-show="currentPage === 'dii-table-advice'"
      :env="env"
      @update:env="env = $event"
    />
    <!-- V16+：SQL 池独立子页 DaoSqlPool 下线，导入入口集成到 DaoSqlList 头部 -->

    <!-- V19：表关系 ER 图 -->
    <DaoErDiagram
      v-show="currentPage === 'dii-er'"
      :env="env"
      @update:env="env = $event"
    />

    <!-- V20：慢SQL维度分析 -->
    <DaoSlowSqlList
      v-show="currentPage === 'dii-slow-sql'"
      :env="env"
      :filter="slowListFilter"
      @update:env="env = $event"
      @clear-todo-filter="slowListFilter = {}"
    />

    <!-- 二级覆盖页：仅保留巡检任务详情；SQL 详情页已下线 -->
    <DaoTaskDetail
      v-if="overlay?.type === 'task-detail'"
      :task-id="overlay.id"
      @close="overlay = null"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import DaoDashboard from './DaoDashboard.vue'
import DaoSqlList from './DaoSqlList.vue'
import DaoTaskList from './DaoTaskList.vue'
import DaoTableAdvice from './DaoTableAdvice.vue'
import DaoErDiagram from './DaoErDiagram.vue'
import DaoSlowSqlList from './DaoSlowSqlList.vue'
import DaoTaskDetail from './DaoTaskDetail.vue'

const props = defineProps({
  currentPage: { type: String, default: 'dii-dashboard' },
})

const emit = defineEmits(['navigate-page'])

const env = ref(localStorage.getItem('dii-env') || 'uat')
watch(env, (v) => localStorage.setItem('dii-env', v))

// SQL 列表筛选条件，从 Dashboard 点击"未处理 POOR"等卡片跳转时传入
const sqlListFilter = ref({})
// 慢SQL 列表筛选（铃铛「慢SQL待办」跳来时 = 我的待审）
const slowListFilter = ref({})

// 详情页"覆盖"状态（简单栈，不做 Router）
// { type: 'task-detail', id }
const overlay = ref(null)

function openTaskDetail(id) {
  overlay.value = { type: 'task-detail', id }
}

/**
 * 从巡检任务列表 [查看 SQL 列表] 按钮跳来。
 * payload: { taskId: number, taskNo: string }
 */
function handleGotoSqlsFromTask(payload) {
  if (!payload?.taskId) return
  sqlListFilter.value = { taskId: payload.taskId, taskNo: payload.taskNo }
  overlay.value = null
  emit('navigate-page', 'dii-sqls')
}

/**
 * 从 SQL 维度分析页 banner [← 返回任务列表] 跳回。
 * 同时清空 sqlListFilter，避免下次进 SQL 列表还残留 taskId 过滤。
 */
function handleBackToTasks() {
  sqlListFilter.value = {}
  overlay.value = null
  emit('navigate-page', 'dii-tasks')
}

/**
 * V16：父级（TransactionAnalysis）通过 ref 调用——打开 SQL 巡检页并启用「我的待审」过滤
 */
function openMyWhitelistTodo() {
  sqlListFilter.value = { myWhitelistTodo: true }
  overlay.value = null
  emit('navigate-page', 'dii-sqls')
}
/** v5：铃铛「慢SQL待办」→ 打开慢SQL页 + 我的待审过滤 */
function openMySlowTodo() {
  slowListFilter.value = { myApprovalTodo: true }
  overlay.value = null
  emit('navigate-page', 'dii-slow-sql')
}
defineExpose({ openMyWhitelistTodo, openMySlowTodo })

/**
 * Dashboard 卡片 / 趋势图点击 → 跳到 SQL 列表并带上筛选
 */
function handleGoto(payload) {
  if (!payload) return
  if (payload.target === 'sqls') {
    sqlListFilter.value = payload.filter || {}
    overlay.value = null
    emit('navigate-page', 'dii-sqls')
    return
  }
  if (payload.target === 'tasks') {
    overlay.value = null
    emit('navigate-page', 'dii-tasks')
    return
  }
  if (payload.target === 'table-advice') {
    overlay.value = null
    emit('navigate-page', 'dii-table-advice')
  }
}
</script>

<style scoped>
.dii-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  position: relative;
}
</style>
