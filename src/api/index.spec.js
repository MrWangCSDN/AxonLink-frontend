import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { download, exportFlowtranDomainChains, request } from './index.js'
import router, { clearCurrentUser } from '../router/index.js'

vi.mock('../router/index.js', () => ({
  clearCurrentUser: vi.fn(),
  default: {
    currentRoute: { value: { path: '/', fullPath: '/' } },
    push: vi.fn(),
  },
}))

describe('flowtran domain chain export API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('sends the shared trigger token in the export request header', async () => {
    fetch.mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['xlsx'])),
      headers: { get: vi.fn(() => '') },
    })

    await exportFlowtranDomainChains('public', 'secret')

    expect(fetch).toHaveBeenCalledWith(
      '/api/flowtran/domains/public/chains/export',
      { credentials: 'same-origin', headers: { 'X-DII-Trigger-Token': 'secret' } },
    )
  })

  it('preserves the backend token error message', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('口令错误'),
    })

    await expect(exportFlowtranDomainChains('deposit', 'wrong'))
      .rejects.toThrow('口令错误')
  })

  it('preserves nested validation error codes and data', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: vi.fn().mockResolvedValue({
        code: 422,
        message: '比对字段必须包含 BASE 母库全部主键',
        data: {
          errorCode: 'BASE_PRIMARY_KEYS_REQUIRED',
          tableName: 'acct_master',
          missingPrimaryKeyNames: ['f'],
        },
      }),
    })

    const error = await request('/ai/parallel-replay/database-comparison-fields/7').catch(cause => cause)

    expect(error.code).toBe('BASE_PRIMARY_KEYS_REQUIRED')
    expect(error.data).toEqual(expect.objectContaining({
      tableName: 'acct_master',
      missingPrimaryKeyNames: ['f'],
    }))
  })

  it('preserves structured backend errors for file downloads', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        code: 422,
        message: '2 项配置无法生成生产脚本',
        data: {
          errorCode: 'CONFIG_SCRIPT_VALIDATION_FAILED',
          errors: [
            { tableName: 'bad-table', fieldName: null, reason: '表英文名不是合法数据库标识符' },
            { tableName: 'acct_master', fieldName: 'bad field', reason: '字段英文名不是合法数据库标识符' },
          ],
        },
      })),
    })

    const error = await download('/ai/test.sql', 'test.sql').catch(cause => cause)

    expect(error).toMatchObject({
      name: 'ApiError',
      status: 422,
      code: 'CONFIG_SCRIPT_VALIDATION_FAILED',
      data: { errors: expect.any(Array) },
    })
  })
})


describe('401 session verification', () => {
  const reply = (status, code, data = null) => ({
    status, ok: status >= 200 && status < 300,
    json: async () => ({ code, message: '用户未登录', data }),
  })
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each([401, 200])('keeps the editor route when a %s save response reports 401 but the session is valid', async status => {
    fetch.mockResolvedValueOnce(reply(status, 401))
      .mockResolvedValueOnce(reply(200, 200, { username: 'c-wangsh8' }))
    await expect(request('/ai/parallel-replay/database-comparison-fields/3', { method: 'PUT' }))
      .rejects.toMatchObject({ status, code: 401 })
    expect(fetch).toHaveBeenLastCalledWith('/api/auth/me', expect.any(Object))
    expect(router.push).not.toHaveBeenCalled()
    expect(clearCurrentUser).not.toHaveBeenCalled()
  })

  it('clears the cached identity and redirects only when the session probe also returns 401', async () => {
    fetch.mockResolvedValueOnce(reply(401, 401)).mockResolvedValueOnce(reply(401, 401))
    await expect(request('/ai/test', { method: 'PUT' })).rejects.toMatchObject({ code: 401 })
    expect(clearCurrentUser).toHaveBeenCalledOnce()
    expect(router.push).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/' } })
  })

  it.each([404, 503])('keeps the route when the session probe returns %s', async status => {
    fetch.mockResolvedValueOnce(reply(401, 401)).mockResolvedValueOnce(reply(status, status))
    await expect(request('/ai/test')).rejects.toMatchObject({ code: 401 })
    expect(router.push).not.toHaveBeenCalled()
  })

  it('does not recurse or navigate for the login page and router session checks', async () => {
    fetch.mockResolvedValue(reply(401, 401))
    await expect(request('/auth/me')).rejects.toMatchObject({ code: 401 })
    await expect(request('/auth/login', { method: 'POST' })).rejects.toMatchObject({ code: 401 })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(router.push).not.toHaveBeenCalled()
  })
})
