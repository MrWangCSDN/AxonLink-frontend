import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getReplayIssueOptions,
  getReplayIssueHeaderFilterOptionCounts,
  getReplayImportRounds,
  getReplayIssueRoundTracking,
  getReplayIssueGroupSummaries,
  getReplayIssuePersonRankings,
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
  it('encodes list filters and paging', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0, items: [] } }))

    await listReplayIssues({ limit: 50, offset: 100, groupName: '贷款组', sandbox: false, issueId: 'ISSUE 001', groupNames: ['公共组', '贷款组'], sandboxes: ['是', '否'], keyword: 'CCBS 响应' })

    expect(fetch.mock.calls[0][0]).toContain('limit=50')
    expect(fetch.mock.calls[0][0]).toContain('offset=100')
    expect(fetch.mock.calls[0][0]).toContain('groupName=%E8%B4%B7%E6%AC%BE%E7%BB%84')
    expect(fetch.mock.calls[0][0]).toContain('sandbox=false')
    expect(fetch.mock.calls[0][0]).toContain('issueId=ISSUE%20001')
    expect(fetch.mock.calls[0][0]).toContain('groupNames=%E5%85%AC%E5%85%B1%E7%BB%84&groupNames=%E8%B4%B7%E6%AC%BE%E7%BB%84')
    expect(fetch.mock.calls[0][0]).toContain('sandboxes=%E6%98%AF&sandboxes=%E5%90%A6')
    expect(fetch.mock.calls[0][0]).toContain('keyword=CCBS%20%E5%93%8D%E5%BA%94')
  })

  it('defaults an omitted list limit to 50', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0, items: [] } }))

    await listReplayIssues({ offset: 100 })

    expect(fetch.mock.calls[0][0]).toContain('limit=50')
    expect(fetch.mock.calls[0][0]).toContain('offset=100')
  })

  it.each([
    [0, 1],
    [500, 200],
  ])('clamps list limit %i to %i', async (limit, expectedLimit) => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0, items: [] } }))

    await listReplayIssues({ limit, offset: 100 })

    expect(fetch.mock.calls[0][0]).toContain(`limit=${expectedLimit}`)
    expect(fetch.mock.calls[0][0]).toContain('offset=100')
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

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/header-filter-option-counts?field=transactionName&keyword=%E8%B4%A6%E6%88%B7&groupNames=%E5%85%AC%E5%85%B1%E7%BB%84&groupNames=%E8%B4%B7%E6%AC%BE%E7%BB%84')
    expect(result).toEqual(payload)
  })

  it('gets replay issue stats for the selected grouping dimension', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0 } }))

    await getReplayIssueStats({ groupBy: 'issueDomain' })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/stats?groupBy=issueDomain')
  })

  it('gets planned completion date points and dashboard through the dedicated statistics paths', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { points: [] } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { groups: [] } }))

    await getReplayCompletionDatePoints()
    await getReplayCompletionDashboard({ startDate: '2026-08-20', endDate: '2026-08-27', groupBy: 'issueDomain' })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/stats/planned-completion/date-points')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/stats/planned-completion?startDate=2026-08-20&endDate=2026-08-27&groupBy=issueDomain')
  })

  it('encodes the exact group developer category and paging filters for completion drill-down', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0, items: [] } }))

    await getReplayCompletionIssues({
      startDate: '2026-08-20',
      endDate: '2026-08-27',
      groupBy: 'issueDomain',
      groupName: '贷款组',
      matchedDeveloper: '张三、李四',
      category: 'OVERDUE_UNFINISHED',
      limit: 20,
      offset: 40,
    })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/stats/planned-completion/issues?startDate=2026-08-20&endDate=2026-08-27&groupBy=issueDomain&groupName=%E8%B4%B7%E6%AC%BE%E7%BB%84&matchedDeveloper=%E5%BC%A0%E4%B8%89%E3%80%81%E6%9D%8E%E5%9B%9B&category=OVERDUE_UNFINISHED&limit=20&offset=40')
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

    await getReplayIssueGroupSummaries({ groupBy: 'issueDomain' })
    await getReplayIssuePersonRankings({ groupBy: 'issueDomain' })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/stats/groups?groupBy=issueDomain')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/stats/person-ranking?groupBy=issueDomain')
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
