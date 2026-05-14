/**
 * 影响分析 Mock：对齐 PermissionRole / 构件调用规则示意图。
 *
 * 启用方式（任一）：
 * - 地址栏加 ?impactMock=1
 * - localStorage.setItem('axonImpactMock', '1') 后刷新
 * - .env 中 VITE_IMPACT_MOCK=true
 *
 * 规则摘要（调用方 → 被调方）：
 * - PCS 仅能被 PBF（联机交易侧入口服务）调用
 * - PBS 仅能被 PBF、PCS 调用
 * - PBCB/PBCP 仅能被 PBS 调用
 * - PBCC 可被 PBS、PBCB、PBCP 调用
 * - PBCT 可被 PBS、PBCB、PBCP、PBCC 调用
 */

/**
 * @returns {boolean}
 */
export function isImpactMockEnabled() {
  if (typeof window === 'undefined') return false
  try {
    if (import.meta.env?.VITE_IMPACT_MOCK === 'true') return true
  } catch {
    /* ignore */
  }
  if (window.localStorage?.getItem('axonImpactMock') === '1') return true
  if (new URLSearchParams(window.location.search).get('impactMock') === '1') return true
  return false
}

/** 与后端 getChain 结构一致的最小子集 */
function mockChainDpAcc() {
  const tableCode = 'DpAccQuery'

  const components = [
    { code: 'pbct_dpacc_crypto', name: '账户字段加解密', prefix: 'pbct', desc: '技术构件' },
    { code: 'pbcc_dpacc_audit', name: '账户访问审计', prefix: 'pbcc', desc: '公共构件' },
    { code: 'pbcb_dpacc_query', name: '存款账户查询业务', prefix: 'pbcb', desc: '业务构件' },
    { code: 'pbcp_dpacc_fee', name: '账户费用试算产品', prefix: 'pbcp', desc: '产品构件' },
  ]

  const services = [
    { code: 'pbs_dpacc_core_query', name: '账户核心查询', prefix: 'pbs', desc: '基础服务' },
    { code: 'pcs_dpacc_bundle', name: '账户信息组合查询', prefix: 'pcs', desc: '组合服务' },
    { code: 'pbf_dpacc_entry', name: '开销户信息查询流程', prefix: 'pbf', desc: '流程服务(入口)' },
  ]

  const relations = {
    rootServices: ['pbf_dpacc_entry'],
    /** caller → callees */
    serviceToService: {
      pbf_dpacc_entry: ['pcs_dpacc_bundle'],
      pcs_dpacc_bundle: ['pbs_dpacc_core_query'],
    },
    serviceToComponent: {
      pbs_dpacc_core_query: ['pbcb_dpacc_query', 'pbcp_dpacc_fee'],
    },
    /** caller → callees（业务/产品 → 公共/技术） */
    componentToComponent: {
      pbcb_dpacc_query: ['pbcc_dpacc_audit', 'pbct_dpacc_crypto'],
      pbcp_dpacc_fee: ['pbcc_dpacc_audit'],
      pbcc_dpacc_audit: ['pbct_dpacc_crypto'],
    },
    componentToData: {},
    /** 构件/服务 到 表 */
    nodeToData: {
      pbct_dpacc_crypto: [tableCode],
      pbcc_dpacc_audit: [],
      pbcb_dpacc_query: [tableCode],
      pbcp_dpacc_fee: [],
      pbs_dpacc_core_query: [],
      pcs_dpacc_bundle: [],
      pbf_dpacc_entry: [],
    },
  }

  return {
    orchestration: [],
    service: services,
    component: components,
    data: [{ code: tableCode, name: '存款账户主档', desc: 'Mock 表' }],
    relations,
  }
}

/**
 * @returns {object[]} 伪交易列表，可并入影响分析数据源
 */
export function getMockImpactTransactions() {
  return [
    {
      id: 'mock-tx-dpacc',
      name: '开销户信息查询（Mock）',
      code: 'dp2028',
      domain: '聚合领域',
      domainKey: 'aggr',
      chain: mockChainDpAcc(),
    },
  ]
}
