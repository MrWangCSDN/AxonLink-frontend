<!--
  登录页（LDAP 接入 - B 档登录保护）

  设计要点：
  - 居中卡片表单（用户名 + 密码 + 登录按钮）
  - 全部颜色走 CSS 变量（var(--xxx)），light/dark 双主题自动适配
  - 不依赖任何 UI 框架，纯 HTML + scoped CSS
  - 首屏快速调 /api/auth/me：若已登录直接跳首页
  - 后端 enabled=false 时 /me 返 404，本页"沉默放过"（不强制跳），让用户能看到登录页
    （但理论上 enabled=false 时根本不会路由到 /login，这是兜底）
  - 错误中文化：401 → "用户名或密码错误"；503 → "认证服务不可用"；其它 → "登录失败：..."

  主题：复用 style.css 的 token；不引入新变量。
-->
<template>
  <div class="login-page" :data-theme="isDark ? 'dark' : 'light'">
    <div class="login-card">
      <!-- 顶部 logo + 标题 -->
      <div class="login-header">
        <img src="/spd-bank-logo.png" alt="浦发银行" class="login-logo" />
        <div class="login-title-group">
          <h1 class="login-title">
            <span class="title-axon">欢迎</span>
          </h1>
          <p class="login-subtitle">请使用域账号登录</p>
        </div>
      </div>

      <!-- Tab 切换：当 uiasEnabled 时显示，否则不显 -->
      <div v-if="showTabs" class="login-tabs" role="tablist" aria-label="登录方式">
        <button
          type="button"
          role="tab"
          class="login-tab"
          :class="{ active: activeTab === 'UIAS' }"
          :aria-selected="activeTab === 'UIAS'"
          @click="switchTab('UIAS')"
        >统一认证登录</button>
        <button
          type="button"
          role="tab"
          class="login-tab"
          :class="{ active: activeTab === 'LDAP' }"
          :aria-selected="activeTab === 'LDAP'"
          @click="switchTab('LDAP')"
        >LDAP登录</button>
      </div>

      <!-- UIAS Tab 内容 -->
      <div v-if="activeTab === 'UIAS'" class="uias-panel">
        <p class="uias-hint">点击下方按钮跳转浦发统一认证（域内员工免输密码）</p>
        <div v-if="errorMessage" class="form-error" role="alert">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M8 5v3.5M8 11v.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span>{{ errorMessage }}</span>
        </div>
        <button type="button" class="form-submit" @click="onUiasLogin">跳转登录</button>
      </div>

      <!-- LDAP Tab 内容（原表单） -->
      <form v-else class="login-form" @submit.prevent="onSubmit">
        <label class="form-field">
          <span class="form-label">域账号</span>
          <input
            v-model="username"
            type="text"
            class="form-input"
            placeholder="请输入域账号"
            autocomplete="username"
            :disabled="loading"
            @input="clearError"
            ref="usernameRef"
          />
        </label>
        <label class="form-field">
          <span class="form-label">密码</span>
          <input
            v-model="password"
            type="password"
            class="form-input"
            placeholder="请输入密码"
            autocomplete="current-password"
            :disabled="loading"
            @input="clearError"
          />
        </label>
        <div v-if="errorMessage" class="form-error" role="alert">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M8 5v3.5M8 11v.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span>{{ errorMessage }}</span>
        </div>
        <button type="submit" class="form-submit" :disabled="loading || !canSubmit">
          <span v-if="!loading">登录</span>
          <span v-else class="submit-loading">
            <svg class="submit-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-opacity="0.25" stroke-width="2"/>
              <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            登录中...
          </span>
        </button>
      </form>

      <p class="login-footer">登录即代表同意《数据安全使用规范》</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { login, getCurrentUser, getAuthConfig } from '../api/auth.js'
import { clearCurrentUser } from '../router/index.js'

const router = useRouter()
const route = useRoute()

// 表单字段
const username = ref('')
const password = ref('')

// UI 状态
const loading = ref(false)
const errorMessage = ref('')
const usernameRef = ref(null)

// 主题
const isDark = ref(localStorage.getItem('theme') === 'dark')

// Tab 状态
const ldapEnabled = ref(true)   // 兜底默认显 LDAP
const uiasEnabled = ref(false)
const activeTab = ref('LDAP')

const showTabs = computed(() => uiasEnabled.value && ldapEnabled.value)
const canSubmit = computed(() => username.value.trim() && password.value.length > 0)

function clearError() {
  if (errorMessage.value) errorMessage.value = ''
}

function switchTab(tab) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  errorMessage.value = ''
  // 切到 LDAP 时聚焦用户名
  if (tab === 'LDAP') {
    nextTick(() => usernameRef.value?.focus())
  }
}

/** 把后端异常翻译成中文友好提示 */
function formatError(e) {
  const status = e?.status ?? 0
  const msg = e?.message || ''
  if (status === 401) return '用户名或密码错误'
  if (status === 503) return '认证服务不可用，请稍后再试'
  if (status === 404) return '鉴权服务未启用'
  return `登录失败：${msg || '未知错误'}`
}

/** URL ?error= query 中文化（UIAS callback 失败时回跳带的） */
function formatQueryError(code) {
  switch (code) {
    case 'uias_not_configured': return '统一认证 SDK 未配置，请联系系统管理员或改用 LDAP 登录'
    case 'uias_no_empno': return '统一认证回调未携带工号信息（SDK 集成异常）'
    case 'user_not_found': return '系统中未找到该用户，请联系管理员开通账号'
    case 'user_disabled': return '账号已被禁用，请联系管理员'
    case 'uias_callback_failed': return '统一认证回调异常，请重试或改用 LDAP 登录'
    default: return ''
  }
}

async function onSubmit() {
  if (loading.value || !canSubmit.value) return
  errorMessage.value = ''
  loading.value = true
  try {
    await login(username.value.trim(), password.value)
    clearCurrentUser()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (e) {
    errorMessage.value = formatError(e)
  } finally {
    loading.value = false
  }
}

function onUiasLogin() {
  // 浏览器跳走 UIAS 流程；后端 302 处理后续
  window.location.href = '/api/auth/uias/login'
}

onMounted(async () => {
  // 1. 处理 URL ?error= query（UIAS callback 失败时回跳带的）
  const errCode = typeof route.query.error === 'string' ? route.query.error : ''
  if (errCode) {
    const msg = formatQueryError(errCode)
    if (msg) errorMessage.value = msg
  }

  // 2. 拉服务端 config 决定显几个 Tab + 默认
  try {
    const cfg = await getAuthConfig()
    if (cfg && typeof cfg === 'object') {
      ldapEnabled.value = cfg.ldapEnabled !== false  // 默认 true
      uiasEnabled.value = cfg.uiasEnabled === true
      // defaultMethod: "UIAS"/"LDAP"/"NONE"
      if (cfg.defaultMethod === 'UIAS' && uiasEnabled.value) {
        activeTab.value = 'UIAS'
      } else {
        activeTab.value = 'LDAP'
      }
    }
  } catch (_) {
    // 后端 config 拉不到 → 兜底显 LDAP Tab（既有行为不破坏）
    ldapEnabled.value = true
    uiasEnabled.value = false
    activeTab.value = 'LDAP'
  }

  // 3. 自动聚焦用户名（仅 LDAP Tab 激活时）
  if (activeTab.value === 'LDAP') {
    await nextTick()
    usernameRef.value?.focus()
  }

  // 4. 探测当前是否已登录；若是直接跳首页
  try {
    const user = await getCurrentUser()
    if (user) {
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
      router.replace(redirect)
    }
  } catch (_) {
    // 401/404/网络异常都不处理：留在登录页即可
  }
})
</script>

<style scoped>
/* ──────────────────────────────────────────────────────────────
   登录页：纯 CSS 变量，light/dark 双主题自适配
   注意：scoped 样式 + :data-theme 切换在内层（卡片本体）；外层
   .login-page 也写 :data-theme 是为了让卡片内的 [data-theme="dark"]
   选择器（来自 style.css token 定义）生效。
   ────────────────────────────────────────────────────────────── */
.login-page {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-page);
  color: var(--text-primary);
  /* 背景轻微渐变（用 var 走 token，dark 下自动切换） */
  background-image:
    radial-gradient(circle at 20% 20%, var(--bg-domain-active) 0%, transparent 40%),
    radial-gradient(circle at 80% 80%, var(--bg-domain-active) 0%, transparent 45%);
  background-color: var(--bg-page);
  padding: 24px;
  overflow: auto;
}

/* ── 登录卡片 ── */
.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 36px 32px 28px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
}

/* dark 主题下阴影更深一些，避免卡片"浮不起来" */
:global([data-theme="dark"]) .login-card {
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
}

/* ── 顶部 logo 区 ── */
.login-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 28px;
}

.login-logo {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: contain;
  background: var(--bg-badge);
  padding: 4px;
}

.login-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.login-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  line-height: 1.2;
}

.title-axon {
  color: var(--text-primary);
}

.title-link {
  color: var(--text-active);
  margin-left: 2px;
}

.login-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

/* ── 表单字段 ── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.form-input::placeholder {
  color: var(--text-faint);
}

.form-input:hover:not(:disabled) {
  border-color: var(--text-faint);
}

.form-input:focus:not(:disabled) {
  border-color: var(--text-active);
  box-shadow: 0 0 0 3px var(--bg-domain-active);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── 错误提示 ── */
.form-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--c-rating-error);
  background: var(--build-sync-error-bg);
  border: 1px solid var(--build-sync-error-border);
  border-radius: 6px;
}

/* ── 提交按钮 ── */
.form-submit {
  height: 42px;
  margin-top: 4px;
  font-size: 14px;
  font-weight: 500;
  /* 按钮内文字色：走主题专属 --btn-primary-text token
     （light=#FFFFFF / dark=#0D1424，两个值都在 style.css 主题层定义） */
  color: var(--btn-primary-text);
  background: var(--text-active);
  border: 1px solid var(--text-active);
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.05s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.form-submit:hover:not(:disabled) {
  opacity: 0.92;
}

.form-submit:active:not(:disabled) {
  transform: translateY(1px);
}

.form-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.submit-loading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.submit-spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── 底部说明 ── */
.login-footer {
  margin-top: 22px;
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
}

/* ── Tab pill（增强 v2）── */
.login-tabs {
  display: inline-flex;
  gap: 0;
  padding: 4px;
  background: var(--tab-bg-inactive);
  border-radius: 999px;
  margin-bottom: 22px;
  align-self: center;
  width: fit-content;
}

.login-tab {
  flex: 0 0 auto;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--tab-text-inactive);
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.login-tab:hover:not(.active) {
  color: var(--text-primary);
}

.login-tab.active {
  background: var(--tab-bg-active);
  color: var(--tab-text-active);
}

/* tabs 居中（卡片内） */
.login-card {
  display: flex;
  flex-direction: column;
}

/* ── UIAS 面板 ── */
.uias-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.uias-hint {
  margin: 0;
  padding: 14px 16px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-card-secondary);
  border-radius: 8px;
  line-height: 1.5;
}
</style>
