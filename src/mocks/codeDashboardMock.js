/**
 * 代码提交大屏 mock 数据（样式预览用）。
 *
 * dev 模式（VITE_USE_MOCK 默认开）下 vite 无 /api 代理，fetch 命中 SPA 兜底返回 HTML，
 * api/codeDashboard.js 的 getCodeRepos / getCodeOverview 捕获后降级到这里。
 * 结构与后端 CodeDashboardController 的 R.data 完全一致。
 */

const SNAPSHOT = '2026-05-19 01:12'

export function getCodeReposMock() {
  return [
    { id: 1, repo_name: 'ccbs-loan',  last_sync_commit: '20e767a1', last_sync_time: SNAPSHOT, last_sync_status: 'SUCCESS' },
    { id: 2, repo_name: 'ccbs-deposit', last_sync_commit: 'b3f9c042', last_sync_time: SNAPSHOT, last_sync_status: 'SUCCESS' },
  ]
}

// 作者 Top（owned_lines 降序）；厂商 email 以 c- 或 t- 开头
const TOP_AUTHORS = [
  { author_email: 'zhangw@126.com.cn',  person_name: '张伟',  person_type: 'STAFF',  owned_lines: 38200, file_count: 412, added_lines: 51200, deleted_lines: 13100 },
  { author_email: 'c-liq@vendor.com',   person_name: 'c-李强', person_type: 'VENDOR', owned_lines: 31500, file_count: 295, added_lines: 44800, deleted_lines: 14600 },
  { author_email: 'wangf@126.com.cn',   person_name: '王芳',  person_type: 'STAFF',  owned_lines: 28900, file_count: 351, added_lines: 36900, deleted_lines: 9300 },
  { author_email: 'liuy@126.com.cn',    person_name: '刘洋',  person_type: 'STAFF',  owned_lines: 24100, file_count: 287, added_lines: 30500, deleted_lines: 8100 },
  { author_email: 'c-chenx@vendor.com', person_name: 'c-陈晓', person_type: 'VENDOR', owned_lines: 22600, file_count: 233, added_lines: 33100, deleted_lines: 11200 },
  { author_email: 'zhaom@126.com.cn',   person_name: '赵敏',  person_type: 'STAFF',  owned_lines: 19800, file_count: 246, added_lines: 25400, deleted_lines: 6900 },
  { author_email: 'c-sunl@vendor.com',  person_name: 'c-孙磊', person_type: 'VENDOR', owned_lines: 17400, file_count: 188, added_lines: 26700, deleted_lines: 9800 },
  { author_email: 'zhouj@126.com.cn',   person_name: '周杰',  person_type: 'STAFF',  owned_lines: 15200, file_count: 201, added_lines: 19800, deleted_lines: 5200 },
  { author_email: 'wuxiu@126.com.cn',   person_name: '吴秀',  person_type: 'STAFF',  owned_lines: 12600, file_count: 167, added_lines: 16100, deleted_lines: 4300 },
  { author_email: 'c-zhengs@vendor.com',person_name: 'c-郑爽', person_type: 'VENDOR', owned_lines: 10900, file_count: 142, added_lines: 17500, deleted_lines: 6600 },
]

// 领域 staff+vendor 之和 == 420000（与 byType 一致）
const BY_DOMAIN = [
  { domainKey: 'loan',       ownedLines: 150000, fileCount: 1320, staffOwned: 95000, vendorOwned: 55000, sharePct: 35.7 },
  { domainKey: 'deposit',    ownedLines: 110000, fileCount: 980,  staffOwned: 70000, vendorOwned: 40000, sharePct: 26.2 },
  { domainKey: 'settlement', ownedLines: 80000,  fileCount: 712,  staffOwned: 52000, vendorOwned: 28000, sharePct: 19.0 },
  { domainKey: 'platform',   ownedLines: 50000,  fileCount: 466,  staffOwned: 28000, vendorOwned: 22000, sharePct: 11.9 },
  { domainKey: 'public',     ownedLines: 30000,  fileCount: 388,  staffOwned: 15000, vendorOwned: 15000, sharePct: 7.1 },
]

// 行员×交易归属（code_person_tx_stat 来源；仅含 STAFF，tx_ids 逗号分隔）
const TOP_PERSONS = [
  { author_email: 'zhangw@126.com.cn',  person_name: '张伟',  person_type: 'STAFF', owned_lines: 38200, file_count: 412, tx_ids: 'TC0076,TC0089,TC0102,TC0115', tx_count: 4, snapshot_time: SNAPSHOT },
  { author_email: 'wangf@126.com.cn',   person_name: '王芳',  person_type: 'STAFF', owned_lines: 28900, file_count: 351, tx_ids: 'TC0077,TC0078,TC0091',          tx_count: 3, snapshot_time: SNAPSHOT },
  { author_email: 'liuy@126.com.cn',    person_name: '刘洋',  person_type: 'STAFF', owned_lines: 24100, file_count: 287, tx_ids: 'TC0076,TC0103',                  tx_count: 2, snapshot_time: SNAPSHOT },
  { author_email: 'zhaom@126.com.cn',   person_name: '赵敏',  person_type: 'STAFF', owned_lines: 19800, file_count: 246, tx_ids: 'TC0089,TC0090,TC0104,TC0116,TC0127', tx_count: 5, snapshot_time: SNAPSHOT },
  { author_email: 'zhouj@126.com.cn',   person_name: '周杰',  person_type: 'STAFF', owned_lines: 15200, file_count: 201, tx_ids: 'TC0078',                         tx_count: 1, snapshot_time: SNAPSHOT },
  { author_email: 'wuxiu@126.com.cn',   person_name: '吴秀',  person_type: 'STAFF', owned_lines: 12600, file_count: 167, tx_ids: 'TC0077,TC0091,TC0102',           tx_count: 3, snapshot_time: SNAPSHOT },
  { author_email: 'chenb@126.com.cn',   person_name: '陈斌',  person_type: 'STAFF', owned_lines: 10200, file_count: 134, tx_ids: null,                             tx_count: 0, snapshot_time: SNAPSHOT },
  { author_email: 'linh@126.com.cn',    person_name: '林浩',  person_type: 'STAFF', owned_lines:  8700, file_count: 118, tx_ids: 'TC0115,TC0116',                  tx_count: 2, snapshot_time: SNAPSHOT },
  { author_email: 'yangj@126.com.cn',   person_name: '杨洁',  person_type: 'STAFF', owned_lines:  7500, file_count: 103, tx_ids: 'TC0089,TC0103',                  tx_count: 2, snapshot_time: SNAPSHOT },
  { author_email: 'maok@126.com.cn',    person_name: '毛凯',  person_type: 'STAFF', owned_lines:  6800, file_count:  92, tx_ids: null,                             tx_count: 0, snapshot_time: SNAPSHOT },
  { author_email: 'pengx@126.com.cn',   person_name: '彭旭',  person_type: 'STAFF', owned_lines:  5900, file_count:  87, tx_ids: 'TC0078,TC0104,TC0127',           tx_count: 3, snapshot_time: SNAPSHOT },
  { author_email: 'dongl@126.com.cn',   person_name: '董磊',  person_type: 'STAFF', owned_lines:  4700, file_count:  71, tx_ids: 'TC0076',                         tx_count: 1, snapshot_time: SNAPSHOT },
  { author_email: 'tangy@126.com.cn',   person_name: '唐燕',  person_type: 'STAFF', owned_lines:  3800, file_count:  58, tx_ids: null,                             tx_count: 0, snapshot_time: SNAPSHOT },
]

export function getCodeOverviewMock(repoId) {
  return {
    repoId: Number(repoId) || 1,
    totalOwnedLines: 420000,
    byType: [
      { person_type: 'STAFF',  author_count: 18, owned_lines: 260000, file_count: 2410, added_lines: 331000, deleted_lines: 88000, share_pct: 61.9, snapshot_time: SNAPSHOT },
      { person_type: 'VENDOR', author_count: 10, owned_lines: 160000, file_count: 1456, added_lines: 248000, deleted_lines: 92000, share_pct: 38.1, snapshot_time: SNAPSHOT },
    ],
    topPersons: TOP_PERSONS,
    topAuthors: TOP_AUTHORS,
    byDomain: BY_DOMAIN,
    topTx: [],
    snapshotTime: SNAPSHOT,
  }
}

export function getCodeTrendMock() {
  const now = new Date()
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    const base = 420000 + (6 - i) * 1200
    result.push({
      stat_date: date,
      total_owned_lines: base,
      staff_owned_lines: Math.floor(base * 0.62),
      vendor_owned_lines: Math.floor(base * 0.38),
      author_count: 25 + (6 - i),
      file_count: 3800 + (6 - i) * 15,
    })
  }
  return result
}
