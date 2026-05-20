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
