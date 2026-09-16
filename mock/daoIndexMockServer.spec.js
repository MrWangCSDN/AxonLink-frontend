import { describe, expect, it } from 'vitest'
import { Readable } from 'node:stream'
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

function replayServer() {
  const middlewares = []
  replayMock.daoIndexMockPlugin().configureServer({ middlewares: { use: handler => middlewares.push(handler) } })
  return async function request(method, path, body, headers = {}) {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)])
    req.method = method
    req.url = `/api/ai/parallel-replay/issues${path}`
    req.headers = headers
    return new Promise((resolve, reject) => {
      const headers = {}
      const res = {
        statusCode: 200,
        setHeader(name, value) { headers[name.toLowerCase()] = value },
        end(payload) {
          const contentType = headers['content-type'] || ''
          resolve({
            status: this.statusCode,
            headers,
            data: contentType.includes('spreadsheet') ? payload : JSON.parse(String(payload)).data,
          })
        },
      }
      middlewares[0](req, res, () => reject(new Error(`replay route ${path} was not handled`)))
    })
  }
}

function databaseComparisonServer() {
  const middlewares = []
  replayMock.daoIndexMockPlugin().configureServer({ middlewares: { use: handler => middlewares.push(handler) } })
  return async function request(method, path, body, headers = {}) {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)])
    req.method = method
    req.url = `/api/ai/parallel-replay/database-comparison-fields${path}`
    req.headers = headers
    return new Promise((resolve, reject) => {
      const responseHeaders = {}
      const res = {
        statusCode: 200,
        setHeader(name, value) { responseHeaders[name.toLowerCase()] = value },
        end(payload) {
          const contentType = responseHeaders['content-type'] || ''
          if (contentType.includes('application/sql')) {
            resolve({ status: this.statusCode, headers: responseHeaders, data: Buffer.from(payload) })
            return
          }
          const parsed = JSON.parse(String(payload))
          resolve({ status: this.statusCode, headers: responseHeaders, data: parsed.data, message: parsed.message })
        },
      }
      middlewares[0](req, res, () => reject(new Error(`database comparison route ${path} was not handled`)))
    })
  }
}

describe('replay database comparison version mock', () => {
  it('provides three immutable version summaries and the latest version', async () => {
    const request = databaseComparisonServer()

    const latest = await request('GET', '/versions/latest')
    const versions = await request('GET', '/versions?page=0&size=20')

    expect(latest.data).toMatchObject({ versionNo: '20260914-160001', latest: true })
    expect(versions.data).toMatchObject({ page: 0, size: 20, total: 3 })
    expect(versions.data.items.map(item => item.versionNo)).toEqual([
      '20260914-160001', '20260913-143020', '20260912-091530',
    ])
    expect(versions.data.items[0]).toMatchObject({ tableCount: expect.any(Number), fieldCount: expect.any(Number) })
  })

  it('filters and paginates a selected version snapshot', async () => {
    const request = databaseComparisonServer()

    const result = await request('POST', '/versions/20260914-160001/search', {
      tableKeyword: 'deposit',
      fieldKeyword: 'acct_no',
      domains: ['存款组'],
      reviserEmpNos: ['c-zhangs'],
      page: 0,
      size: 5,
    })

    expect(result.data.page).toBe(0)
    expect(result.data.size).toBe(5)
    expect(result.data.total).toBeGreaterThan(5)
    expect(result.data.items).toHaveLength(5)
    expect(result.data.items.every(item => item.domainName === '存款组')).toBe(true)
    expect(result.data.items.every(item => item.reviserEmpNo === 'c-zhangs')).toBe(true)
    expect(result.data.items.every(item => item.fields.some(field => field.columnName === 'acct_no'))).toBe(true)
  })

  it('provides counted filter options for snapshot headers', async () => {
    const request = databaseComparisonServer()

    const result = await request('POST', '/versions/20260914-160001/header-filter-options', {
      targetColumn: 'reviser', keyword: '张', limit: 200,
    })

    expect(result.data.matchedRegistrationCount).toBeGreaterThan(0)
    expect(result.data.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'c-zhangs', label: '张三(c-zhangs)', count: expect.any(Number) }),
    ]))
  })

  it('rejects a wrong token and creates a new latest snapshot with the shared token', async () => {
    const request = databaseComparisonServer()

    const unauthorized = await request('POST', '/versions/generate', undefined, { 'x-dii-trigger-token': 'wrong' })
    expect(unauthorized.status).toBe(401)
    expect(unauthorized.data.errorCode).toBe('INVALID_TRIGGER_TOKEN')

    const generated = await request('POST', '/versions/generate', undefined, { 'x-dii-trigger-token': 'secret' })
    expect(generated.data).toMatchObject({ versionNo: expect.stringMatching(/^\d{8}-\d{6}$/), tableCount: 80, fieldCount: expect.any(Number) })
    expect(generated.data.generatedAt.replace(/[-:T]/g, '').slice(0, 14))
      .toBe(generated.data.versionNo.replace('-', ''))

    const latest = await request('GET', '/versions/latest')
    expect(latest.data.versionNo).toBe(generated.data.versionNo)
    expect(latest.data.latest).toBe(true)
  })

  it('generates one immutable script and serves generated and ungenerated version states', async () => {
    const request = databaseComparisonServer()

    const initial = await request('GET', '/versions/20260914-160001/config-script')
    const preGenerated = await request('GET', '/versions/20260913-143020/config-script')
    const missingDownload = await request(
      'GET', '/versions/20260914-160001/config-script/download',
    )

    expect(initial.data).toEqual({ generated: false })
    expect(preGenerated.data).toMatchObject({
      generated: true,
      fileName: 'replay-db-compare-config-20260913-143020.sql',
    })
    expect(missingDownload.status).toBe(404)
    expect(missingDownload.data.errorCode).toBe('CONFIG_SCRIPT_NOT_GENERATED')

    const first = await request('POST', '/versions/20260914-160001/config-script')
    const second = await request('POST', '/versions/20260914-160001/config-script')
    const downloaded = await request(
      'GET', '/versions/20260914-160001/config-script/download',
    )
    const generatedStatus = await request('GET', '/versions/20260914-160001/config-script')

    expect(first.headers['content-type']).toContain('application/sql')
    expect(first.headers['content-disposition']).toContain(
      "filename*=UTF-8''replay-db-compare-config-20260914-160001.sql",
    )
    expect(first.data.toString()).toContain('TRUNCATE TABLE tss_bcomp_field;')
    expect(first.data.toString()).toContain('INSERT INTO tss_bcomp_conf')
    expect(first.data.toString()).toContain('INSERT INTO tss_bcomp_table_sql')
    expect(second.data.equals(first.data)).toBe(true)
    expect(downloaded.data.equals(first.data)).toBe(true)
    expect(generatedStatus.data).toMatchObject({
      generated: true,
      sha256: first.headers['x-content-sha256'],
    })
  })
})

describe('replay issue counted header filter mock', () => {
  it('serves list and counted filters from POST JSON bodies', async () => {
    const request = replayServer()
    const longDescription = '不存在的问题描述'.repeat(1000)

    const list = (await request('POST', '', {
      query: { limit: 50, issueDescriptions: [longDescription] },
    })).data
    const counts = (await request('POST', '/header-filter-option-counts', {
      field: 'issueDescription',
      keyword: '不存在',
      query: { issueDescriptions: [longDescription] },
    })).data

    expect(list).toEqual({ total: 0, items: [] })
    expect(counts).toMatchObject({
      candidateCount: 0,
      matchedIssueCount: 0,
      items: [],
    })
  })

  it('daily report snapshot remains generated after imports and issue edits', async () => {
    const request = replayServer()
    const initial = (await request('GET', '/daily-report/batches')).data
    const ungenerated = initial.find(entry => entry.canGenerate && !entry.generated)
    const initiallyGenerated = initial.find(entry => entry.generated)

    expect(initial.some(entry => !entry.canGenerate)).toBe(true)
    expect(ungenerated).toBeTruthy()
    expect(initiallyGenerated).toBeTruthy()

    const generatedDownload = await request('GET', `/daily-report?batchNo=${ungenerated.batchNo}`)
    expect(generatedDownload.headers['content-type']).toContain('spreadsheetml.sheet')
    expect(generatedDownload.headers['content-disposition']).toContain('.xlsx')
    expect((await request('GET', '/daily-report/batches')).data.find(entry => entry.batchNo === ungenerated.batchNo).generated).toBe(true)

    await request('GET', `/daily-report?batchNo=${ungenerated.batchNo}`)
    await request('PATCH', '/1', {
      issueStatus: '新建', issueType: '迁移问题', remark: '只修改备注',
    })
    expect((await request('GET', '/daily-report/batches')).data.some(entry => entry.generated)).toBe(true)

    await request('PATCH', '/1', {
      issueStatus: '打开', issueType: '迁移问题', remark: '修改状态',
    })
    expect((await request('GET', '/daily-report/batches')).data.find(entry => entry.batchNo === ungenerated.batchNo).generated).toBe(true)

    await request('POST', '/import')
    expect((await request('GET', '/daily-report/batches')).data.find(entry => entry.batchNo === ungenerated.batchNo).generated).toBe(true)
  })

  it('sends only an existing daily report with the shared token and retains mail status after edits', async () => {
    const request = replayServer()
    const batches = (await request('GET', '/daily-report/batches')).data
    const generated = batches.find(entry => entry.generated)

    const config = await request('GET', `/daily-report/mail-config?batchNo=${generated.batchNo}`)
    expect(config.data).toMatchObject({
      batchNo: generated.batchNo,
      status: 'UNSENT',
      toEmails: ['replay-owner@example.com'],
      body: '各位好，附件为本批次回放问题日报，请查收。',
    })

    const payload = { batchNo: generated.batchNo, subject: '自定义标题', toEmails: ['new@example.com'], ccEmails: [], body: '日报正文' }
    const unauthorized = await request('POST', '/daily-report/mail-send', payload)
    expect(unauthorized.status).toBe(401)

    const sent = await request('POST', '/daily-report/mail-send', payload, {
      'x-dii-trigger-token': 'secret',
    })
    expect(sent.data.status).toBe('SENT')
    expect(sent.data).toMatchObject({ subject: '自定义标题', toEmails: ['new@example.com'], ccEmails: [], body: '日报正文' })
    expect((await request('GET', '/daily-report/batches')).data.find(entry => entry.batchNo === generated.batchNo).mailStatus).toBe('SENT')

    await request('PATCH', '/1', { issueStatus: '修复待验证', issueType: '迁移问题', remark: '修改状态' })
    const retained = (await request('GET', '/daily-report/batches')).data.find(entry => entry.batchNo === generated.batchNo)
    expect(retained.generated).toBe(true)
    expect(retained.mailStatus).toBe('SENT')
  })

  it('generates a permanent weekly report pair and retains its mail status', async () => {
    const request = replayServer()
    const options = (await request('GET', '/weekly-report/options')).data

    expect(options.dailyBatches.filter(entry => entry.family === 'RPT')).toHaveLength(4)
    expect(options.dailyBatches.filter(entry => entry.family === 'DZ')).toHaveLength(2)
    expect(options.weeklyReports).toHaveLength(5)
    expect(new Set(options.weeklyReports.map(entry => entry.endBatchNo)).size).toBe(5)
    const startBatchNo = 'RPT20260818-01'
    const endBatchNo = 'RPT20260902-01'

    const generated = await request('GET', `/weekly-report?startBatchNo=${startBatchNo}&endBatchNo=${endBatchNo}`)
    expect(generated.headers['content-disposition']).toContain(encodeURIComponent(`${endBatchNo}周报.xlsx`))
    expect((await request('GET', '/weekly-report/options')).data.weeklyReports)
      .toEqual(expect.arrayContaining([expect.objectContaining({ startBatchNo, endBatchNo })]))

    const config = await request('GET', `/weekly-report/mail-config?startBatchNo=${startBatchNo}&endBatchNo=${endBatchNo}`)
    expect(config.data).toMatchObject({
      subject: '对公分布式核心回放问题周报-20260902',
      toEmails: ['replay-owner@example.com'], status: 'UNSENT',
    })
    const payload = {
      startBatchNo, endBatchNo, subject: '自定义周报',
      toEmails: ['new@example.com'], ccEmails: [], body: '周报正文',
    }
    const sent = await request('POST', '/weekly-report/mail-send', payload, {
      'x-dii-trigger-token': 'secret',
    })
    expect(sent.data.status).toBe('SENT')
    expect((await request('GET', '/weekly-report/options')).data.weeklyReports
      .find(entry => entry.startBatchNo === startBatchNo && entry.endBatchNo === endBatchNo).mailStatus).toBe('SENT')

    const duplicateEnd = await request('GET', `/weekly-report?startBatchNo=RPT20260825-01&endBatchNo=${endBatchNo}`)
    expect(duplicateEnd.status).toBe(409)
  })

  it('rejects changing a reopened issue back to open', async () => {
    const request = replayServer()

    const response = await request('PATCH', '/6', {
      issueStatus: '打开', issueType: '代码问题', remark: '不允许回退',
    })

    expect(response.status).toBe(400)
    expect(issueList({ limit: 50 }).items.find(issue => issue.id === 6).issue_status).toBe('重新打开')
  })

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

  it('keeps person ranking schedule counts aligned with its date detail', () => {
    const rankings = replayGet('/stats/person-ranking', { groupBy: 'issueDomain', replayType: 'ALL' })
    const ranking = rankings.find(row => row.scheduleTotalCount > 0 && row.schedulePlannedCount > 0)

    expect(rankings.every(row => row.scheduleTotalCount === row.newCount + row.openCount + row.reopenedCount)).toBe(true)
    expect(rankings.every(row => row.schedulePlannedCount <= row.scheduleTotalCount)).toBe(true)
    expect(ranking).toBeTruthy()

    const schedule = replayGet('/stats/person-ranking/schedule', {
      groupBy: 'issueDomain', replayType: 'ALL', groupName: ranking.groupName, developer: ranking.developer,
    })
    const dates = schedule.dateCounts.map(row => row.plannedCompletionDate)

    expect(schedule.scheduleTotalCount).toBe(ranking.scheduleTotalCount)
    expect(schedule.schedulePlannedCount).toBe(ranking.schedulePlannedCount)
    expect(schedule.schedulePlannedCount + schedule.scheduleUnplannedCount).toBe(schedule.scheduleTotalCount)
    expect(schedule.dateCounts.reduce((sum, row) => sum + row.count, 0)).toBe(schedule.schedulePlannedCount)
    expect(dates).toEqual([...dates].sort())
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

function replayConfigServer() {
  const middlewares = []
  replayMock.daoIndexMockPlugin().configureServer({ middlewares: { use: handler => middlewares.push(handler) } })
  return async function request(method, path, body) {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)])
    req.method = method
    req.url = `/api/ai/parallel-replay/config${path}`
    req.headers = {}
    return new Promise((resolve, reject) => {
      const responseHeaders = {}
      const res = {
        statusCode: 200,
        setHeader(name, value) { responseHeaders[name.toLowerCase()] = value },
        end(payload) {
          resolve({ status: this.statusCode, body: payload ? JSON.parse(String(payload)) : null })
        },
      }
      middlewares[0](req, res, () => reject(new Error(`config route ${path} was not handled`)))
    })
  }
}

describe('replay config management mock', () => {
  it('lists seeded rows and filters by internal transaction code', async () => {
    const request = replayConfigServer()
    const all = await request('GET', '/unconditional-ignores')
    expect(all.status).toBe(200)
    expect(all.body.data.total).toBeGreaterThan(10)
    // 默认每页 10 条
    expect(all.body.data.items).toHaveLength(10)

    const mapped = await request('GET', '/unconditional-ignores?internalTransactionCode=Y444')
    expect(mapped.body.data.total).toBeGreaterThan(0)
    expect(mapped.body.data.total).toBeLessThan(all.body.data.total)

    const unmapped = await request('GET', '/unconditional-ignores?internalTransactionCode=NOPE')
    expect(unmapped.body.data.total).toBe(0)

    const invalid = await request('GET', '/unconditional-ignores?limit=25')
    expect(invalid.status).toBe(400)
    expect(invalid.body.code).toBe(400)
  })

  it('creates, rejects duplicates and validates service code', async () => {
    const request = replayConfigServer()
    const baseline = (await request('GET', '/unconditional-ignores')).body.data.total
    const created = await request('POST', '/unconditional-ignores', {
      tranCode: 'S900TestQry&sop', fieldName: 'accountNo',
    })
    expect(created.status).toBe(200)
    expect(created.body.data.version).toBe(0)
    expect(created.body.data.enableFlag).toBe(1)

    const duplicate = await request('POST', '/unconditional-ignores', {
      tranCode: 'S900TestQry&sop', fieldName: 'accountNo',
    })
    expect(duplicate.status).toBe(409)

    const invalid = await request('POST', '/unconditional-ignores', {
      tranCode: 'bad-code', fieldName: 'accountNo',
    })
    expect(invalid.status).toBe(400)

    const list = await request('GET', '/unconditional-ignores')
    expect(list.body.data.total).toBe(baseline + 1)
  })

  it('updates with optimistic lock and exposes history changes', async () => {
    const request = replayConfigServer()
    const list = await request('GET', '/unconditional-ignores?limit=10')
    const row = list.body.data.items[0]

    const conflict = await request('PATCH', `/unconditional-ignores/${row.id}`, {
      tranCode: row.tranCode, fieldName: 'changed', version: 99,
    })
    expect(conflict.status).toBe(409)

    const updated = await request('PATCH', `/unconditional-ignores/${row.id}`, {
      tranCode: row.tranCode, fieldName: 'changed', version: row.version,
    })
    expect(updated.status).toBe(200)
    expect(updated.body.data.version).toBe(1)

    const history = await request('GET', `/unconditional-ignores/${row.id}/operations`)
    expect(history.body.data.total).toBe(2)
    expect(history.body.data.items[0].operationType).toBe('UPDATE')
    expect(history.body.data.items[0].changes).toEqual([
      expect.objectContaining({ field: 'field_name', oldValue: row.fieldName, newValue: 'changed' }),
    ])
  })

  it('deletes with version and rolls back inconsistent batch delete', async () => {
    const request = replayConfigServer()
    const baseline = (await request('GET', '/unconditional-ignores')).body.data.total
    const list = await request('GET', '/unconditional-ignores')
    const [first, second] = list.body.data.items

    const badBatch = await request('POST', '/unconditional-ignores/batch-delete', {
      items: [{ id: first.id, version: first.version }, { id: second.id, version: 99 }],
    })
    expect(badBatch.status).toBe(409)
    expect((await request('GET', '/unconditional-ignores')).body.data.total).toBe(baseline)

    const goodBatch = await request('POST', '/unconditional-ignores/batch-delete', {
      items: [{ id: first.id, version: first.version }, { id: second.id, version: second.version }],
    })
    expect(goodBatch.body.data.deletedCount).toBe(2)
    expect((await request('GET', '/unconditional-ignores')).body.data.total).toBe(baseline - 2)
  })

  it('allocates conditional index per service code', async () => {
    const request = replayConfigServer()
    const created = await request('POST', '/conditional-ignores', {
      origTrcd: 'S120034071CorpInfoQryTrdCrclr&soap', fieldRmoveName: 'third', fieldFileFlag: 1,
    })
    expect(created.body.data.fieldFileIndx).toBe(3)

    const other = await request('POST', '/conditional-ignores', {
      origTrcd: 'S777NewQry&sop', fieldRmoveName: 'first', fieldFileFlag: 2,
    })
    expect(other.body.data.fieldFileIndx).toBe(1)
  })

  it('rejects error code config with both codes empty', async () => {
    const request = replayConfigServer()
    const invalid = await request('POST', '/error-code-ignores', {
      serviceCode: 'S900TestQry&sop', oldRespCode: '', newRespCode: null,
    })
    expect(invalid.status).toBe(400)
    expect(invalid.body.message).toContain('不能同时为空')
  })

  it('expands sort field creation into three rows and rejects unknown tran code', async () => {
    const request = replayConfigServer()
    const created = await request('POST', '/sort-fields', {
      tranCode: 'Z999', oldSortField: 'accounts.accountNo', newSortField: 'loans(loanNo,loanType)',
    })
    expect(created.status).toBe(200)
    expect(created.body.data).toHaveLength(3)
    expect(created.body.data.map((row) => row.origTrcd)).toEqual([
      'S120033800LoanQuery&sop', 'S120033800LoanQuery&soap', 'S120033800LoanQuery&bzjson',
    ])
    expect(created.body.data[0]).toMatchObject({ origArryName: 'accounts', origFieldName: 'accountNo' })
    expect(created.body.data[1]).toMatchObject({ origArryName: 'loans', origFieldName: 'loanNo,loanType' })

    const unmapped = await request('POST', '/sort-fields', {
      tranCode: '9999', oldSortField: 'a.b', newSortField: 'c.d',
    })
    expect(unmapped.status).toBe(400)
  })
})
