/**
 * 鉴权 API
 *
 * 后端对应：com.axonlink.security.AuthController
 * 路由前缀：/api/auth
 *
 * 后端在 axon-link.security.enabled=true 时才装配；
 * enabled=false 时 /api/auth/me 会返回 404，由 router guard 兼容处理（视为"无鉴权模式"放行）。
 */
import { request } from './index.js'

/**
 * 登录
 * 成功：返回 { username }
 * 失败：抛出异常（HTTP 401，message="用户名或密码错误"）
 */
export function login(username, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

/**
 * 登出
 * 成功：返回 null（后端 data:null）
 */
export function logout() {
  return request('/auth/logout', { method: 'POST' })
}

/**
 * 获取当前登录用户
 * 已登录：返回 { username }
 * 未登录：抛出异常（HTTP 401，message="未登录"）
 * 鉴权未启用（enabled=false）：抛出异常（HTTP 404，由 guard 视为放行）
 */
export function getCurrentUser() {
  return request('/auth/me')
}

/**
 * GET /api/auth/config —— 拉登录配置（哪些方式 enabled + 默认选哪个）。
 *
 * <p>返回：{ ldapEnabled, uiasEnabled, defaultMethod }，
 * 其中 defaultMethod ∈ {"UIAS","LDAP","NONE"}。
 *
 * <p>异常处理：调用方自己 catch；常见情况：
 * - 200 但 enabled=false 时 → 调用方据此隐藏对应 Tab
 * - 404 → 后端鉴权未启用（AuthController @ConditionalOnProperty 未装），
 *         调用方默认显 LDAP Tab 兜底
 * - 网络/500 → 同 404 处理
 */
export async function getAuthConfig() {
  return await request('/auth/config')
}
