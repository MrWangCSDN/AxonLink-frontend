import { describe, expect, it } from 'vitest'
import * as replayMock from './daoIndexMockServer.js'

function countedOptions(query) {
  expect(replayMock.replayHeaderFilterOptionCounts).toBeTypeOf('function')
  if (!replayMock.replayHeaderFilterOptionCounts) return { candidateCount: 0, matchedIssueCount: 0, truncated: false, items: [] }
  return replayMock.replayHeaderFilterOptionCounts(query)
}

function issueList(params = {}) {
  const middlewares = []
  replayMock.daoIndexMockPlugin().configureServer({ middlewares: { use: handler => middlewares.push(handler) } })
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item)
  })
  let payload
  middlewares[0](
    { method: 'GET', url: `/api/ai/parallel-replay/issues?${query}` },
    { setHeader() {}, end(body) { payload = JSON.parse(body) } },
    () => { throw new Error('replay issue list route was not handled') },
  )
  return payload.data
}

function replayGet(path, params = {}) {
  const middlewares = []
  replayMock.daoIndexMockPlugin().configureServer({ middlewares: { use: handler => middlewares.push(handler) } })
  const query = new URLSearchParams(params)
  let payload
  middlewares[0](
    { method: 'GET', url: `/api/ai/parallel-replay/issues${path}${query.size ? `?${query}` : ''}` },
    { setHeader() {}, end(body) { payload = JSON.parse(body) } },
    () => { throw new Error(`replay route ${path} was not handled`) },
  )
  return payload.data
}

describe('replay issue counted header filter mock', () => {
  it('returns four domain groups or six issue-domain groups while keeping developer names', () => {
    const domainGroups = replayGet('/stats/groups', { groupBy: 'domain' })
    const issueDomainGroups = replayGet('/stats/groups', { groupBy: 'issueDomain' })
    const issueDomainRankings = replayGet('/stats/person-ranking', { groupBy: 'issueDomain' })
    const issueDomainStats = replayGet('/stats', { groupBy: 'issueDomain' })

    expect(new Set(domainGroups.map(row => row.groupName))).toEqual(new Set(['公共组', '存款组', '贷款组', '结算组']))
    expect(new Set(issueDomainGroups.map(row => row.groupName))).toEqual(new Set(['公共组', '存款组', '贷款组', '结算组', '迁移组', '平台组']))
    expect(new Set(issueDomainRankings.map(row => row.groupName))).toEqual(new Set(['公共组', '存款组', '贷款组', '结算组', '迁移组', '平台组']))
    expect(issueDomainRankings.every(row => row.developer.length > 0)).toBe(true)
    expect(issueDomainRankings.some(row => row.developer === '张三(c-zhangs3)')).toBe(true)
    expect(new Set(Object.keys(issueDomainStats.groupCounts))).toEqual(new Set(['公共组', '存款组', '贷款组', '结算组', '迁移组', '平台组']))
  })

  it('provides all six issue domains with zero-to-three transfer counts for the UI demo', () => {
    const items = issueList({ limit: 50 }).items

    expect(new Set(items.map(item => item.issue_domain))).toEqual(new Set(['存款组', '贷款组', '公共组', '结算组', '迁移组', '平台组']))
    expect(new Set(items.map(item => item.issue_domain_transfer_count))).toEqual(new Set([0, 1, 2, 3]))
  })

  it('groups planned completion dashboards and drill-downs by issue domain', () => {
    const dashboard = replayGet('/stats/planned-completion', {
      startDate: '2026-08-01', endDate: '2026-08-30', groupBy: 'issueDomain',
    })
    const migrationIssues = replayGet('/stats/planned-completion/issues', {
      startDate: '2026-08-01', endDate: '2026-08-30', groupBy: 'issueDomain',
      groupName: '迁移组', category: 'ON_TIME_FIXED', limit: '200', offset: '0',
    })

    expect(dashboard.groups.map(group => group.groupName)).toEqual(
      ['公共组', '存款组', '贷款组', '结算组', '迁移组', '平台组'],
    )
    expect(dashboard.groups.find(group => group.groupName === '平台组').developers[0].matchedDeveloper)
      .toContain('开发负责人')
    expect(migrationIssues.total).toBeGreaterThan(0)
    expect(migrationIssues.items.every(item => item.issueDomain === '迁移组')).toBe(true)
  })

  it('provides fifty developers in one domain for split-pane scrolling acceptance', () => {
    const dashboard = replayGet('/stats/planned-completion', {
      startDate: '2026-08-01', endDate: '2026-09-05', groupBy: 'domain',
    })

    expect(dashboard.groups.find(group => group.groupName === '存款组').developers).toHaveLength(50)
  })

  it('provides nonzero planned completion dates through September 5 and defaults to mock server today', () => {
    const points = replayGet('/stats/planned-completion/date-points')
    const dashboard = replayGet('/stats/planned-completion')
    const expectedCrossMonthDates = [
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ]

    expect(points.defaultStartDate).toBe('2026-09-01')
    expect(points.defaultEndDate).toBe('2026-09-03')
    expect(points.datePoints).toHaveLength(36)
    expect(points.datePoints.every(point => point.plannedCount > 0)).toBe(true)
    expect(points.datePoints.filter(point => expectedCrossMonthDates.includes(point.date)).map(point => point.date))
      .toEqual(expectedCrossMonthDates)
    expect(dashboard.effectiveStartDate).toBe('2026-09-01')
    expect(dashboard.effectiveEndDate).toBe('2026-09-03')
    expect(dashboard.summary.plannedTotal).toBeGreaterThan(0)
  })

  it('returns counted issue-domain candidates', () => {
    const result = countedOptions({ field: 'issueDomain' })

    expect(result.candidateCount).toBe(6)
    expect(result.matchedIssueCount).toBe(100)
    expect(new Set(result.items.map(item => item.value))).toEqual(
      new Set(['存款组', '贷款组', '公共组', '结算组', '迁移组', '平台组']),
    )
    expect(issueList({ issueDomains: ['公共组', '平台组'], limit: 100 }).items.every(
      item => ['公共组', '平台组'].includes(item.issue_domain),
    )).toBe(true)
  })

  it('sorts affected transaction counts numerically before pagination and keeps invalid values last', () => {
    const issueIds = ['2901', '2902', '2903', '2904', '2905']
    const values = (order) => issueList({
      issueIds,
      limit: 5,
      affectedTransactionCountOrder: order,
    }).items.map(item => item.affected_transaction_count)

    expect(values(undefined)).toEqual(['10', '2', '1', '', 'bad'])
    expect(values('ASC')).toEqual(['1', '2', '10', '', 'bad'])
    expect(values('DESC')).toEqual(['10', '2', '1', '', 'bad'])
  })

  it('returns repeated, empty, and long candidates for every newly filterable text field', () => {
    for (const field of ['transactionName', 'fieldName', 'issueDescription', 'issueKey']) {
      const result = countedOptions({ field })

      expect(result.candidateCount).toBe(result.items.length)
      expect(result.matchedIssueCount).toBe(100)
      expect(result.truncated).toBe(false)
      expect(result.items.some(item => item.value === '空' && item.count > 0), field).toBe(true)
      expect(result.items.some(item => item.count > 1), field).toBe(true)
      expect(result.items.some(item => item.value.length >= 150), field).toBe(true)
    }
  })

  it('counts a split-field issue once even when it belongs to multiple candidates', () => {
    const result = countedOptions({ field: 'developer' })

    expect(result.matchedIssueCount).toBe(100)
    expect(result.items.reduce((sum, item) => sum + item.count, 0)).toBeGreaterThan(result.matchedIssueCount)
  })

  it('applies another long-text filter but excludes the active field own selection', () => {
    const result = countedOptions({
      field: 'issueDescription',
      transactionNames: ['账户余额与可用余额组合查询'],
      issueDescriptions: ['该值必须被排除'],
    })

    expect(result.items).toEqual(expect.arrayContaining([
      { value: '空', count: 5 },
      { value: '新老核心账户余额与可用余额字段比对不一致，需要结合响应码、币种、钞汇标志和账户状态继续排查', count: 5 },
      { value: expect.stringContaining('超长问题描述演示'), count: 5 },
    ]))
    expect(result.items).toHaveLength(3)
  })

  it('keeps the legacy candidate response as strings', () => {
    expect(replayMock.replayHeaderFilterOptions).toBeTypeOf('function')
    if (!replayMock.replayHeaderFilterOptions) return

    const legacy = replayMock.replayHeaderFilterOptions({ field: 'fieldName', keyword: '账户' })
    expect(legacy.length).toBeGreaterThan(0)
    expect(legacy.every(value => typeof value === 'string')).toBe(true)
  })

  it('serves counted options from the Vite middleware route instead of the issue list payload', () => {
    const middlewares = []
    replayMock.daoIndexMockPlugin().configureServer({ middlewares: { use: handler => middlewares.push(handler) } })
    let payload
    const response = {
      setHeader() {},
      end(body) { payload = JSON.parse(body) },
    }

    middlewares[0](
      { method: 'GET', url: '/api/ai/parallel-replay/issues/header-filter-option-counts?field=fieldName' },
      response,
      () => { throw new Error('counted header filter route was not handled') },
    )

    expect(payload.code).toBe(200)
    expect(payload.data).toMatchObject({ candidateCount: expect.any(Number), matchedIssueCount: 100, truncated: false })
    expect(payload.data.items[0]).toEqual(expect.objectContaining({ value: expect.any(String), count: expect.any(Number) }))
  })
})
