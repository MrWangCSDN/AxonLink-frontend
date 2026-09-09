import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getReplayIssueOptions,
  getReplayIssueHeaderFilterOptionCounts,
  getReplayImportRounds,
  getReplayIssueRoundTracking,
  getReplayIssueGroupSummaries,
  getReplayIssuePersonRankings,
  getReplayIssuePersonSchedule,
  getReplayIssueStats,
  getReplayCompletionDatePoints,
  getReplayCompletionDashboard,
  getReplayCompletionIssues,
  getReplayIssueReviewPermissions,
  getReplayIssuePlanDatePermissions,
  getReplayIssuePlanDateChanges,
  getReplayIssueDomainPermissions,
  getReplayIssueDomainTransfers,
  updateReplayIssuePlannedCompletionDate,
  updateReplayIssueDomain,
  approveReplayIssue,
  getReplayWeeklyTask,
  replaceReplayWeeklyTask,
  downloadReplayDailyReport,
  getReplayDailyReportMailConfig,
  sendReplayDailyReportMail,
  getReplayWeeklyReportOptions,
  downloadReplayWeeklyReport,
  getReplayWeeklyReportMailConfig,
  sendReplayWeeklyReportMail,
  importReplayIssues,
  listReplayIssues,
  updateReplayIssue,
} from './replayIssues.js'

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const nativeFetch = global.fetch

afterEach(() => {
  global.fetch = nativeFetch
})

describe('replay issues API', () => {
  it('sends long list and header filters in JSON request bodies', async () => {
    const longDescription = '超长问题描述'.repeat(2000)
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { total: 0, items: [] } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { candidateCount: 0, matchedIssueCount: 0, truncated: false, items: [] } }))

    await listReplayIssues({ limit: 50, issueDescriptions: [longDescription] })
    await getReplayIssueHeaderFilterOptionCounts({ field: 'issueDescription', keyword: '错误码', issueDescriptions: [longDescription] })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues')
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      query: { limit: 50, issueDescriptions: [longDescription] },
    })
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/header-filter-option-counts')
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
      field: 'issueDescription', keyword: '错误码', query: { issueDescriptions: [longDescription] },
    })
  })

  it('sends list filters and paging in JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0, items: [] } }))

    await listReplayIssues({ limit: 50, offset: 100, groupName: '贷款组', sandbox: false, issueId: 'ISSUE 001', groupNames: ['公共组', '贷款组'], sandboxes: ['是', '否'], keyword: 'CCBS 响应' })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      query: {
        limit: 50,
        offset: 100,
        groupName: '贷款组',
        sandbox: false,
        issueId: 'ISSUE 001',
        groupNames: ['公共组', '贷款组'],
        sandboxes: ['是', '否'],
        keyword: 'CCBS 响应',
      },
    })
  })

  it('defaults an omitted list limit to 50', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0, items: [] } }))

    await listReplayIssues({ offset: 100 })

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ query: { limit: 50, offset: 100 } })
  })

  it.each([
    [0, 1],
    [500, 200],
  ])('clamps list limit %i to %i', async (limit, expectedLimit) => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0, items: [] } }))

    await listReplayIssues({ limit, offset: 100 })

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ query: { limit: expectedLimit, offset: 100 } })
  })

  it('gets replay issue filter options', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { groups: [] } }))

    await getReplayIssueOptions()

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/options')
  })

  it('gets counted header filter options with repeated filters', async () => {
    const payload = { candidateCount: 1, truncated: false, items: [{ value: '账户查询', count: 2 }] }
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: payload }))

    const result = await getReplayIssueHeaderFilterOptionCounts({
      field: 'transactionName', keyword: '账户', groupNames: ['公共组', '贷款组'],
    })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/header-filter-option-counts')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      field: 'transactionName',
      keyword: '账户',
      query: { groupNames: ['公共组', '贷款组'] },
    })
    expect(result).toEqual(payload)
  })

  it('gets replay issue stats for the selected grouping dimension', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0 } }))

    await getReplayIssueStats({ groupBy: 'issueDomain' })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/stats?groupBy=issueDomain')
  })

  it('encodes the person ranking schedule context', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { dateCounts: [] } }))

    await getReplayIssuePersonSchedule({
      replayType: 'DZ', groupBy: 'issueDomain', groupName: '存款组', developer: '张三(c-zhangs3)',
    })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/stats/person-ranking/schedule?replayType=DZ&groupBy=issueDomain&groupName=%E5%AD%98%E6%AC%BE%E7%BB%84&developer=%E5%BC%A0%E4%B8%89(c-zhangs3)')
  })

  it('gets planned completion date points and dashboard through the dedicated statistics paths', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { points: [] } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { groups: [] } }))

    await getReplayCompletionDatePoints({ replayType: 'QUERY' })
    await getReplayCompletionDashboard({ startDate: '2026-08-20', endDate: '2026-08-27', groupBy: 'issueDomain', replayType: 'QUERY' })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/stats/planned-completion/date-points?replayType=QUERY')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/stats/planned-completion?startDate=2026-08-20&endDate=2026-08-27&groupBy=issueDomain&replayType=QUERY')
  })

  it('encodes the exact group developer category and paging filters for completion drill-down', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0, items: [] } }))

    await getReplayCompletionIssues({
      startDate: '2026-08-20',
      endDate: '2026-08-27',
      groupBy: 'issueDomain',
      replayType: 'DZ',
      groupName: '贷款组',
      matchedDeveloper: '张三、李四',
      category: 'OVERDUE_UNFINISHED',
      limit: 20,
      offset: 40,
    })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/stats/planned-completion/issues?startDate=2026-08-20&endDate=2026-08-27&groupBy=issueDomain&replayType=DZ&groupName=%E8%B4%B7%E6%AC%BE%E7%BB%84&matchedDeveloper=%E5%BC%A0%E4%B8%89%E3%80%81%E6%9D%8E%E5%9B%9B&category=OVERDUE_UNFINISHED&limit=20&offset=40')
  })

  it('gets review permissions and approves through the documented endpoint', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { reviewableGroups: [] } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { review_status: '已审核' } }))

    await getReplayIssueReviewPermissions()
    await approveReplayIssue(42)

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/review-permissions')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/42/review/approve')
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST' })
  })

  it('gets planned completion date permissions and saves or clears a date', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { editableGroups: ['公共组'] } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { plannedCompletionDate: '2026-08-26' } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { plannedCompletionDate: null } }))

    await getReplayIssuePlanDatePermissions()
    await updateReplayIssuePlannedCompletionDate(42, '2026-08-26')
    await updateReplayIssuePlannedCompletionDate(42, null)

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/plan-date-permissions')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/42/planned-completion-date')
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'PATCH' })
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ plannedCompletionDate: '2026-08-26' })
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ plannedCompletionDate: null })
  })

  it('loads plan validation date change history', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      code: 200,
      data: { changeCount: 1, items: [{ plannedCompletionDate: '2026-08-26' }] },
    }))

    await getReplayIssuePlanDateChanges(42)

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/42/planned-completion-date-changes')
  })

  it('gets issue domain permissions, updates the domain, and loads transfer history', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { editableDomains: ['公共组'] } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { id: 42, issueDomain: '平台组', transferCount: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { transferCount: 1, items: [] } }))

    await getReplayIssueDomainPermissions()
    await updateReplayIssueDomain(42, '平台组')
    await getReplayIssueDomainTransfers(42)

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/issue-domain-permissions')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/42/issue-domain')
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'PATCH' })
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ issueDomain: '平台组' })
    expect(fetch.mock.calls[2][0]).toBe('/api/ai/parallel-replay/issues/42/issue-domain-transfers')
  })

  it('reads and replaces the weekly task batch set with the shared token header', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { batchNames: [], availableBatchNames: [], issueCount: 0 } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { batchNames: ['BATCH-2'], availableBatchNames: ['BATCH-2'], issueCount: 30 } }))

    await getReplayWeeklyTask()
    await replaceReplayWeeklyTask(['BATCH-2'], 'secret')

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/weekly-task')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/weekly-task')
    expect(fetch.mock.calls[1][1]).toMatchObject({
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-DII-Trigger-Token': 'secret',
      },
    })
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ batchNames: ['BATCH-2'] })
  })

  it('gets summary tables for the selected grouping dimension', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: [] }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: [] }))

    await getReplayIssueGroupSummaries({ groupBy: 'issueDomain', replayType: 'DZ' })
    await getReplayIssuePersonRankings({ groupBy: 'issueDomain', replayType: 'QUERY' })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/stats/groups?groupBy=issueDomain&replayType=DZ')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/stats/person-ranking?groupBy=issueDomain&replayType=QUERY')
  })

  it('gets formal import rounds and grouped issue tracking', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: [] }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: [] }))

    await getReplayImportRounds()
    await getReplayIssueRoundTracking(16960)

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/rounds')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/16960/round-tracking')
  })

  it('uses the backend JSON message when a daily report download fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      code: 409,
      message: '没有上批次数据',
      data: null,
    }, 409))

    await expect(downloadReplayDailyReport('RPT20260902-01'))
      .rejects.toMatchObject({ message: '没有上批次数据' })
  })

  it('loads defaults and sends edited daily report mail fields with the token', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { subject: '对公分布式核心回放问题日报-20260908' } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { status: 'SENT' } }))

    await getReplayDailyReportMailConfig('RPT20260908-01')
    await sendReplayDailyReportMail({
      batchNo: 'RPT20260908-01', subject: '自定义标题',
      toEmails: ['to@example.com'], ccEmails: ['cc@example.com'], body: '日报正文',
    }, 'secret')

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/daily-report/mail-config?batchNo=RPT20260908-01')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/daily-report/mail-send')
    expect(fetch.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DII-Trigger-Token': 'secret',
      },
    })
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      batchNo: 'RPT20260908-01', subject: '自定义标题',
      toEmails: ['to@example.com'], ccEmails: ['cc@example.com'], body: '日报正文',
    })
  })

  it('loads weekly options and sends edited weekly report mail fields with the token', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { dailyBatches: [], weeklyReports: [] } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { subject: '对公分布式核心回放问题周报-20260908' } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { status: 'SENT' } }))

    await getReplayWeeklyReportOptions()
    await getReplayWeeklyReportMailConfig('RPT20260901-01', 'RPT20260908-01')
    await sendReplayWeeklyReportMail({
      startBatchNo: 'RPT20260901-01', endBatchNo: 'RPT20260908-01', subject: '自定义周报',
      toEmails: ['to@example.com'], ccEmails: ['cc@example.com'], body: '周报正文',
    }, 'secret')

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/weekly-report/options')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/weekly-report/mail-config?startBatchNo=RPT20260901-01&endBatchNo=RPT20260908-01')
    expect(fetch.mock.calls[2][0]).toBe('/api/ai/parallel-replay/issues/weekly-report/mail-send')
    expect(fetch.mock.calls[2][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-DII-Trigger-Token': 'secret' },
    })
  })

  it('uses the backend JSON message when a weekly report download fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      code: 400, message: '周报起止批次范围错误', data: null,
    }, 400))

    await expect(downloadReplayWeeklyReport('RPT20260908-01', 'RPT20260901-01'))
      .rejects.toMatchObject({ message: '周报起止批次范围错误' })
    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/weekly-report?startBatchNo=RPT20260908-01&endBatchNo=RPT20260901-01')
  })

  it('falls back to plain text for a non-JSON download failure', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('网关暂不可用', { status: 502 }))

    await expect(downloadReplayDailyReport('RPT20260902-01'))
      .rejects.toThrow('网关暂不可用')
  })

  it('falls back to HTTP status for an empty download failure', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 500 }))

    await expect(downloadReplayDailyReport('RPT20260902-01'))
      .rejects.toThrow('HTTP 500')
  })

  it('preserves the backend validation message for an update HTTP 400 response', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 400, message: '该问题状态不能手工选择' }, 400))

    await expect(updateReplayIssue(16960, { issueStatus: null, remark: '111' }))
      .rejects.toThrow('该问题状态不能手工选择')
  })

  it('sends multipart import without a JSON content type', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { totalRows: 8 } }))

    await importReplayIssues(new File(['x'], 'issues.xlsx'), 'secret')

    const options = fetch.mock.calls[0][1]
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('replayType')).toBe('QUERY')
    expect(options.headers['X-DII-Trigger-Token']).toBe('secret')
    expect(options.headers).not.toHaveProperty('Content-Type')
  })

  it('sends the selected replay type with a formal import', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { totalRows: 8 } }))

    await importReplayIssues(new File(['x'], 'issues.xlsx'), 'secret', 'DZ')

    expect(fetch.mock.calls[0][1].body.get('replayType')).toBe('DZ')
  })

  it('preserves the backend token error message with a stable code', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 401, message: '口令不正确' }, 401))

    await expect(importReplayIssues(new File(['x'], 'issues.xlsx'), 'wrong')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
      message: '口令不正确',
    })
  })

  it('preserves the backend busy error message with a stable code', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 409, message: '已有回放问题清单正在导入，请稍后重试' }, 409))

    await expect(importReplayIssues(new File(['x'], 'issues.xlsx'), 'secret')).rejects.toMatchObject({
      code: 'IMPORT_BUSY',
      message: '已有回放问题清单正在导入，请稍后重试',
    })
  })

  it('preserves backend validation messages for other import failures', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 400, message: '文件为空' }, 400))

    await expect(importReplayIssues(new File(['x'], 'issues.xlsx'), 'secret')).rejects.toThrow('文件为空')
  })

})
