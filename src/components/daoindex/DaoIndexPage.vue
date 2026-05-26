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
    <DaoSqlPool
      v-show="currentPage === 'dii-sql-pool'"
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
import DaoSqlPool from './DaoSqlPool.vue'
import DaoTaskDetail from './DaoTaskDetail.vue'

const props = defineProps({
  currentPage: { type: String, default: 'dii-dashboard' },
})

const emit = defineEmits(['navigate-page'])

const env = ref(localStorage.getItem('dii-env') || 'uat')
watch(env, (v) => localStorage.setItem('dii-env', v))

// SQL 列表筛选条件，从 Dashboard 点击"未处理 POOR"等卡片跳转时传入
const sqlListFilter = ref({})

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
