import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getReplayIssueOptions,
  getReplayImportRounds,
  getReplayIssueRoundTracking,
  getReplayIssueGroupSummaries,
  getReplayIssuePersonRankings,
  getReplayIssueStats,
  fullRefreshReplayIssues,
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

    await listReplayIssues({ limit: 50, offset: 100, groupName: '贷款组', sandbox: false, keyword: 'CCBS 响应' })

    expect(fetch.mock.calls[0][0]).toContain('limit=50')
    expect(fetch.mock.calls[0][0]).toContain('offset=100')
    expect(fetch.mock.calls[0][0]).toContain('groupName=%E8%B4%B7%E6%AC%BE%E7%BB%84')
    expect(fetch.mock.calls[0][0]).toContain('sandbox=false')
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

  it('gets replay issue stats', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0 } }))

    await getReplayIssueStats()

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/stats')
  })

  it('gets hover summary tables from their dedicated endpoints', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: [] }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: [] }))

    await getReplayIssueGroupSummaries()
    await getReplayIssuePersonRankings()

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/stats/groups')
    expect(fetch.mock.calls[1][0]).toBe('/api/ai/parallel-replay/issues/stats/person-ranking')
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
    expect(options.headers['X-DII-Trigger-Token']).toBe('secret')
    expect(options.headers).not.toHaveProperty('Content-Type')
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

  it('sends the full refresh file token and explicit confirmation', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { totalRows: 2 } }))
    const file = new File(['x'], 'full-refresh.xlsx')

    await fullRefreshReplayIssues(file, 'secret')

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/full-refresh')
    const options = fetch.mock.calls[0][1]
    expect(options.headers['X-DII-Trigger-Token']).toBe('secret')
    expect(options.headers).not.toHaveProperty('Content-Type')
    expect(options.body.get('file')).toBe(file)
    expect(options.body.get('confirm')).toBe('FULL_REFRESH')
  })

  it.each([
    [401, 'TOKEN_INVALID'],
    [409, 'IMPORT_BUSY'],
  ])('maps full refresh status %i to %s while preserving the message', async (status, code) => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: status, message: '后端原始提示' }, status))

    await expect(fullRefreshReplayIssues(new File(['x'], 'issues.xlsx'), 'secret')).rejects.toMatchObject({
      code,
      message: '后端原始提示',
    })
  })
})
