/**
 * 源码提交分析大屏 API
 *
 * 后端对应：com.axonlink.ai.code.controller.CodeDashboardController
 * 路由前缀：/api/code/dashboard
 *
 * 所有接口返回 R<T>（code=200/message/data），request() 已统一脱壳为 data。
 * 维度口径：工程(repo)/作者/领域；行员-厂商按 c-/t- 前缀规则分类。每日快照（只读 summary）。
 *
 * 请求失败或响应结构异常时向调用方抛出错误，由组件展示错误、空态和重试。
 */
import { request } from './index.js'

const PREFIX = '/code/dashboard'

/** ?a=1&b=2（空值过滤） */
function toQuery(params) {
  const entries = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!entries.length) return ''
  return '?' + entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

/**
 * 已配置代码仓库及最近同步状态（大屏仓库选择器）。
 */
export async function getCodeRepos() {
  const res = await request(`${PREFIX}/repos`)
  // 后端契约：成功 200 + data 为数组。非数组视为异常上抛。
  if (!Array.isArray(res)) {
    throw new Error('repos 返回不是数组：' + (typeof res))
  }
  return res
}

/**
 * 大屏首屏：行员/厂商总览(含占比) + 作者 Top + 领域分布 + 交易 Top（一次返回）。
 * <p>后端返回 {@code {totalOwnedLines, byType, topAuthors, byDomain, topTx, topPersons, snapshotTime}}。
 * @param {number|string} repoId code_repo_config.id
 */
export async function getCodeOverview(repoId) {
  const res = await request(`${PREFIX}/overview${toQuery({ repoId })}`)
  if (!res || typeof res !== 'object' || (res.byType === undefined && res.totalOwnedLines === undefined)) {
    throw new Error('overview 返回结构异常')
  }
  return res
}

/** 工程维度作者存活行排行。 */
export function getCodeAuthors(repoId, limit = 50) {
  return request(`${PREFIX}/authors${toQuery({ repoId, limit })}`)
}

/** 项目级 按领域划分：每领域 行员/厂商 拆分 + 占全仓比。 */
export function getCodeDomains(repoId) {
  return request(`${PREFIX}/domains${toQuery({ repoId })}`)
}

/** 某领域内作者排行（下钻）。 */
export function getCodeDomainAuthors(repoId, domain, limit = 50) {
  return request(`${PREFIX}/domain-authors${toQuery({ repoId, domain, limit })}`)
}

/** 交易维度排行（Phase② 落地 code_tx_file_map 后才有数据）。 */
export function getCodeTx(repoId, limit = 50) {
  return request(`${PREFIX}/tx${toQuery({ repoId, limit })}`)
}

/** 工程代码行数 7 天趋势折线图数据。 */
export function getCodeTrend(repoId, days = 7) {
  return request(`${PREFIX}/trend${toQuery({ repoId, days })}`)
}
