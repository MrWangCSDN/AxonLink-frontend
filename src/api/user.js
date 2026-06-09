/**
 * 用户管理 API
 *
 * 后端对应：com.axonlink.ai.user.controller.UserController
 * 路由前缀：/api/user
 */
import { request } from './index.js'

/** 分页查询用户 */
export function getUserPage(params) {
  const { keyword, status, page = 1, size = 20 } = params || {}
  const query = []
  if (keyword) query.push(`keyword=${encodeURIComponent(keyword)}`)
  if (status !== null && status !== undefined && status !== '') query.push(`status=${status}`)
  query.push(`page=${page}`)
  query.push(`size=${size}`)
  return request(`/user/page?${query.join('&')}`)
}

/** 详情 */
export function getUser(id) {
  return request(`/user/${id}`)
}

/** 新增 */
export function createUser(payload) {
  return request('/user', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 更新 */
export function updateUser(id, payload) {
  return request(`/user/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

/** 启停切换 */
export function updateUserStatus(id, status) {
  return request(`/user/${id}/status?status=${status}`, {
    method: 'PUT',
  })
}

/** 删除 */
export function deleteUser(id) {
  return request(`/user/${id}`, {
    method: 'DELETE',
  })
}
