/**
 * 前端路由
 *
 * 现状：原项目无 router，本期为接入 LDAP 登录保护引入 vue-router 4。
 * 路由结构：
 *   /        → TransactionAnalysis（原 App.vue 直挂的根视图，所有业务页都在这里面切 tab）
 *   /login   → Login（公开页，无需鉴权）
 *
 * Guard 策略：
 *   - to.meta.public 或 to.path === '/login' 直接放行
 *   - 否则调 /api/auth/me 探测：
 *     · 200 → 缓存 user，放行
 *     · 401 → 跳 /login?redirect=...（典型"未登录"）
 *     · 404 → 后端 enabled=false（鉴权未启用，AuthController 不装配）→ 直接放行
 *     · 其它（500/网络异常）→ 直接放行（避免因鉴权服务故障而完全打不开页面；
 *       业务接口若同样失败再由各页面自己处理）
 *
 *   - 缓存策略：currentUser 模块级 ref，首次 guard 命中后不再每次跳转都打 /me；
 *     登出时清空（参见 logout 处调用 clearCurrentUser）
 */
import { createRouter, createWebHistory } from 'vue-router'
import { ref } from 'vue'
import { getCurrentUser } from '../api/auth.js'

// ─── 模块级缓存：当前登录用户 ────────────────────────────────────
// null 表示"未探测过"；{ username } 表示"已登录"；'__no_auth__' 表示"鉴权未启用"
const currentUser = ref(null)

/** 读当前用户（不会触发新的探测） */
export function getCachedUser() {
  return currentUser.value
}

/** 登出后调用：清空缓存，guard 下次会重新探测 */
export function clearCurrentUser() {
  currentUser.value = null
}

/** 路由表 */
const routes = [
  {
    path: '/',
    name: 'Home',
    // 直接复用原 App.vue 挂的根视图，保证所有原业务页面零改动
    component: () => import('../views/TransactionAnalysis.vue'),
  },
  {
    path: '/user',
    name: 'UserManagement',
    component: () => import('../views/user/UserManagement.vue'),
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true },
  },
  // 兜底：未知路径回首页（业务侧通过 currentPage 切 tab，不用嵌套路由）
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * 全局前置守卫
 *
 * 注意：guard 内部直接 catch /me 异常，由 guard 决定跳还是放；
 * 不让 axios 拦截器对 /me 的 401 再触发一次 router.push（虽然拦截器也会跳，
 * 但守卫已经在跳之前 next() 完成，避免双跳）。
 */
router.beforeEach(async (to, from, next) => {
  // 公开路由直接放行
  if (to.meta?.public || to.path === '/login') {
    return next()
  }

  // 已缓存：不再重复打 /me
  if (currentUser.value) {
    return next()
  }

  // 首次进入受保护路由：探测当前登录态
  try {
    const user = await getCurrentUser()
    currentUser.value = user || { username: '' }
    return next()
  } catch (e) {
    // ApiError 携带 status 字段；普通 Error 无 status 视为网络异常
    const status = e?.status ?? 0

    if (status === 401) {
      // 未登录 → 跳 /login（带 redirect）
      return next({
        path: '/login',
        query: { redirect: to.fullPath },
      })
    }

    // 404：后端鉴权未启用（AuthController 在 enabled=false 时不装配）→ 视为"无鉴权模式"放行
    // 5xx / 网络异常：放行（不阻塞业务，避免鉴权服务故障导致全站打不开）
    currentUser.value = '__no_auth__'
    return next()
  }
})

export default router
