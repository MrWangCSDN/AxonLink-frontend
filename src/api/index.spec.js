import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportFlowtranDomainChains } from './index.js'

vi.mock('../router/index.js', () => ({
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
      { headers: { 'X-DII-Trigger-Token': 'secret' } },
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
})
