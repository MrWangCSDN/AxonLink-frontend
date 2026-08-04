import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getReplayIssueOptions,
  getReplayIssueStats,
  importReplayIssues,
  listReplayIssues,
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
})
