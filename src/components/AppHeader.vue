<template>
  <header class="app-header">
    <div class="header-left">
      <div class="logo">
        <!-- 浦发银行 pd 图标（已从原 jpeg 抠出，去掉了 "浦发银行/SPD BANK" 文字）
             图片源：public/spd-bank-logo.png（92×92 正方形白底 PNG） -->
        <img src="/spd-bank-logo.png" alt="浦发银行" class="bank-logo" />
      </div>
      <span class="platform-name">
        <span class="name-axon">对公分布式核心</span><span class="name-link">智能中心</span>
      </span>
    </div>

    <div class="header-center">
      <div class="search-box" :class="{ 'search-error': isNotFound, 'search-loading': isLoading }">
        <svg v-if="!isLoading" class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="#8C94A6" stroke-width="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="#8C94A6" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <svg v-else class="search-icon search-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
          <path d="M8 2a6 6 0 0 1 6 6" stroke="#4F7CFF" stroke-width="2" stroke-linecap="round"/>
        </svg>

        <input
          v-model="searchText"
          type="text"
          placeholder="输入交易码精确查找（如 TD0101），按 Enter 确认"
          class="search-input"
          @keydown.enter="doSearch"
          @keydown.esc="clearSearch"
          @input="onInput"
        />

        <span v-if="isNotFound" class="search-error-tip">暂无此交易</span>
        <button v-if="searchText && !isLoading" class="search-clear" @click="clearSearch" title="清除搜索">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
        <kbd v-else-if="!searchText && !isLoading" class="search-kbd">⌘K</kbd>
      </div>
    </div>

    <div class="header-right">
      <!-- V16：白名单审批铃铛——展示「该我审批」的条数，点击跳到 SQL 巡检页 + 待审过滤
           todoCount=0 时铃铛仍展示但无红点；>0 时显示数字徽章 -->
      <div class="todo-bell" title="待审批的 SQL 白名单申请" @click="onClickBell">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2v1h16v-1l-2-2z M10 21a2 2 0 0 0 4 0"
                stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span v-if="todoCount > 0" class="todo-bell-badge">{{ todoCountText }}</span>
      </div>

      <div class="user-info" @click="toggleUserMenu">
        <div class="avatar">{{ avatarText }}</div>
        <span class="username">{{ displayName }}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="#8C94A6" stroke-width="1.5" stroke-linecap="round"/>
        </svg>

        <div v-if="showUserMenu" class="user-dropdown">
          <div class="dropdown-item">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="5" r="3" stroke="currentColor" stroke-width="1.3"/>
              <path d="M1.5 13c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="currentColor" stroke-width="1.3"/>
            </svg>
            个人信息
          </div>
          <div class="dropdown-item">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M7 4v3l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            操作日志
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-item logout" @click.stop="onLogout">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2H2.5A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12H5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M9 4.5L12.5 7 9 9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <path d="M5.5 7H12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            退出登录
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentUser, logout as apiLogout } from '../api/auth.js'
import { clearCurrentUser } from '../router/index.js'
import { getWhitelistTodoCount } from '../api/daoIndex.js'

const props = defineProps({
  isDark: { type: Boolean, default: false }
})

// 加 navigate-todo 事件：点击铃铛通知父级跳转到 SQL 巡检页并打开"我的待审"过滤
const emit = defineEmits(['search', 'toggleTheme', 'navigate-todo'])

const router = useRouter()

const searchText   = ref('')
const showUserMenu = ref(false)
const isLoading    = ref(false)
const isNotFound   = ref(false)
// 当前登录用户名（鉴权未启用 或 还没探测到时 显示"管理员"作为缺省）
const currentUsername = ref('')

const displayName = computed(() => currentUsername.value || '管理员')
const avatarText = computed(() => {
  const name = currentUsername.value
  if (!name) return '管'
  // 取用户名首字符大写（英文/数字账号都适用；中文则取首个汉字）
  return name.charAt(0).toUpperCase()
})

const setResult = (found) => {
  isLoading.value  = false
  isNotFound.value = !found
}

const onInput = () => { isNotFound.value = false }

const doSearch = () => {
  const code = searchText.value.trim()
  if (!code) return
  isLoading.value  = true
  isNotFound.value = false
  emit('search', code)
}

const clearSearch = () => {
  searchText.value  = ''
  isLoading.value   = false
  isNotFound.value  = false
  emit('search', '')
}

const toggleUserMenu = () => { showUserMenu.value = !showUserMenu.value }

/** 退出登录：调后端 → 清前端缓存 → 跳 /login */
async function onLogout() {
  showUserMenu.value = false
  try {
    await apiLogout()
  } catch (_) {
    // 网络错误也照样清缓存跳 /login，避免用户卡在中间态
  }
  clearCurrentUser()
  currentUsername.value = ''
  router.push('/login')
}

// V16：白名单待办计数（铃铛红点）
const todoCount = ref(0)
const todoCountText = computed(() => (todoCount.value > 99 ? '99+' : String(todoCount.value)))
let todoPollTimer = null

async function refreshTodoCount() {
  try {
    const data = await getWhitelistTodoCount({
      currentUser: currentUsername.value || undefined,
    })
    todoCount.value = Number(data?.count) || 0
  } catch (_) {
    // 鉴权未启用 / 网络错误：保持原数字不变（不闪烁清零）
  }
}

function onClickBell() {
  // 让父级（TransactionAnalysis）切到 SQL 巡检页并打开"我的待审"过滤
  emit('navigate-todo')
}

onMounted(async () => {
  // 接入登录用户名显示：成功就更新；失败（未启用/未登录/网络异常）保留缺省"管理员"
  try {
    const user = await getCurrentUser()
    if (user?.username) {
      currentUsername.value = user.username
      // V16+：写入 localStorage 供 DaoSqlList 等其他组件 fast-path 读取
      // （白名单审批 mode 检测需要真实 LDAP username 匹配 application.l1/l2_approver）
      try { window.localStorage?.setItem('dii-user', user.username) } catch {}
    }
  } catch (_) {
    // 静默：未登录会被 axios 拦截器跳 /login，鉴权未启用就保留缺省文案
  }
  // 启动计数轮询：每 30s 拉一次
  refreshTodoCount()
  todoPollTimer = setInterval(refreshTodoCount, 30_000)
})

onBeforeUnmount(() => {
  if (todoPollTimer) {
    clearInterval(todoPollTimer)
    todoPollTimer = null
  }
})

defineExpose({ setResult })
</script>

<style scoped>
.app-header {
  height: 56px;
  background: #1B2B4B;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 16px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  box-shadow: 0 1px 0 rgba(255,255,255,0.06);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  /* 由于品牌名从 AxonLink 改为「对公分布式核心智能中心」（11 中文字符），
     min-width 从 240px 调整到 320px 给品牌名更多展示空间 */
  min-width: 320px;
}

.logo {
  display: flex;
  align-items: center;
}

/* 浦发银行 pd 图标：92×92 方形白底 PNG（已抠掉文字部分）
   - 显示尺寸 36×36 方形
   - 4px 圆角让方形 logo 在头部更柔和
   - 图本身白底，dark 模式下边缘自然过渡，无需额外画布 */
.bank-logo {
  height: 36px;
  width: 36px;
  display: block;
  border-radius: 4px;
  object-fit: contain;
}

.platform-name {
  /* 字号从 16px 降到 15px：中文字宽更大，避免在窄屏上挤压 search-box */
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  white-space: nowrap;
  /* 中文字体放在前面，确保中文走"PingFang SC / Microsoft YaHei"等字体 */
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', system-ui, -apple-system, sans-serif;
}

.name-axon { color: #FFFFFF; }
.name-link  { color: #7EB8FF; }

.header-center {
  flex: 1;
  max-width: 480px;
  margin: 0 auto;
}

.search-box {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 0 12px;
  height: 36px;
  gap: 8px;
  transition: all 0.2s;
}

.search-box:focus-within {
  background: rgba(255,255,255,0.12);
  border-color: rgba(79,124,255,0.6);
  box-shadow: 0 0 0 3px rgba(79,124,255,0.15);
}

.search-icon { flex-shrink: 0; }

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: #E8EDFB;
  font-size: 13px;
}

.search-input::placeholder { color: #5C6E8C; }

.search-kbd {
  font-size: 10px;
  color: #5C6E8C;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 2px 5px;
  font-family: inherit;
  flex-shrink: 0;
}

.search-error { border-color: rgba(255,77,79,0.6) !important; }
.search-error .search-icon circle { stroke: rgba(255,77,79,0.6); }
.search-error .search-icon path  { stroke: rgba(255,77,79,0.6); }

.search-error-tip {
  font-size: 11px;
  color: #FF6B6B;
  white-space: nowrap;
  flex-shrink: 0;
}

.search-clear {
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.1);
  border: none; border-radius: 50%;
  cursor: pointer; color: #8C94A6;
  flex-shrink: 0;
  transition: all 0.15s;
  padding: 0;
}
.search-clear:hover { background: rgba(255,255,255,0.2); color: #E8EDFB; }

@keyframes spin { to { transform: rotate(360deg); } }
.search-spin { animation: spin 0.8s linear infinite; flex-shrink: 0; }

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.icon-btn {
  position: relative;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  color: #8C94A6;
}

.icon-btn:hover {
  background: rgba(255,255,255,0.12);
  color: #E8EDFB;
}

/* 主题切换按钮 */
.theme-toggle {
  overflow: hidden;
}

.sun-icon {
  color: #FFD166;
  filter: drop-shadow(0 0 4px rgba(255,209,102,0.5));
}

.moon-icon {
  color: #A8C4E8;
}

/* 切换图标过渡动画 */
.theme-icon-enter-active,
.theme-icon-leave-active {
  transition: opacity 0.2s, transform 0.3s;
}
.theme-icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.6);
}
.theme-icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.6);
}

/* V16：白名单审批铃铛 */
.todo-bell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  color: #cfd6e4;
  transition: background 0.18s, color 0.18s;
  margin-right: 4px;
}
.todo-bell:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.todo-bell-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: #ff4d4f;
  color: #fff;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  border: 1.5px solid var(--header-bg, #1f2733);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.user-info {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.user-info:hover { background: rgba(255,255,255,0.08); }

.avatar {
  width: 30px;
  height: 30px;
  background: linear-gradient(135deg, #4F7CFF, #6B4FFF);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: white;
}

.username { font-size: 13px; color: #C8D3E8; }

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--bg-dropdown);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.12);
  min-width: 160px;
  padding: 6px;
  border: 1px solid var(--border);
  z-index: 200;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.dropdown-item:hover { background: var(--bg-domain-hover); }
.dropdown-item.logout { color: #FF4D4F; }

.dropdown-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 4px 0;
}

/* ════════════ Light 主题：把原本"恒暗"的 header 切成纯白 ════════════
   规则：base 是 dark，[data-theme="light"] 全量覆盖一遍 */
[data-theme="light"] .app-header {
  background: #ffffff;
  box-shadow: 0 1px 0 #e1e5eb;
}
[data-theme="light"] .name-axon { color: #14171c; }
[data-theme="light"] .name-link { color: #0b70db; }

[data-theme="light"] .search-box {
  background: #f7f8fa;
  border-color: #e1e5eb;
}
[data-theme="light"] .search-box:focus-within {
  background: #ffffff;
  border-color: #0b70db;
  box-shadow: 0 0 0 3px rgba(11,112,219,0.15);
}
[data-theme="light"] .search-input { color: #14171c; }
[data-theme="light"] .search-input::placeholder { color: #8990a0; }

[data-theme="light"] .search-kbd {
  background: #ffffff;
  color: #5e6975;
  border-color: #e1e5eb;
}
[data-theme="light"] .search-clear {
  background: #e1e5eb;
  color: #5e6975;
}
[data-theme="light"] .search-clear:hover {
  background: #d1d5db;
  color: #14171c;
}

[data-theme="light"] .icon-btn {
  background: #f7f8fa;
  border-color: #e1e5eb;
  color: #5e6975;
}
[data-theme="light"] .icon-btn:hover {
  background: #ffffff;
  border-color: #c1c5cb;
  color: #14171c;
}
[data-theme="light"] .moon-icon { color: #5e6975; }

[data-theme="light"] .user-info:hover { background: #f1f3f5; }
[data-theme="light"] .username { color: #14171c; }
</style>
