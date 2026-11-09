import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadEnv } from 'vite'
import createViteConfig from './vite.config.js'

vi.mock('vite', async importOriginal => ({
  ...await importOriginal(),
  loadEnv: vi.fn(() => ({})),
}))

beforeEach(() => {
  vi.mocked(loadEnv).mockReturnValue({})
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('vite runtime mode', () => {
  it('reads the real backend target from the project environment file', () => {
    vi.stubEnv('AXON_REAL_API_TARGET', '')
    vi.mocked(loadEnv).mockReturnValueOnce({ AXON_REAL_API_TARGET: 'http://api-from-env.example.internal:8123' })

    expect(createViteConfig({ mode: 'development' }).server.proxy['/api'].target)
      .toBe('http://api-from-env.example.internal:8123')
  })

  it('uses the configured real API target without enabling mock plugins', () => {
    vi.stubEnv('AXON_REAL_API_TARGET', 'http://api.example.internal:8123')
    vi.stubEnv('VITE_USE_MOCK', '1')

    for (const mode of ['development', 'production']) {
      const config = createViteConfig({ mode })
      expect(config.server.proxy['/api'].target).toBe('http://api.example.internal:8123')
      expect(config.plugins.map(plugin => plugin.name)).toEqual(['vite:vue'])
    }
  })

  it.each(['development', 'production'])('uses the real backend even if the removed mock flag is set in %s mode', mode => {
    vi.stubEnv('AXON_REAL_API_TARGET', '')
    vi.stubEnv('VITE_USE_MOCK', '1')

    const config = createViteConfig({ mode })

    expect(config.plugins.map(plugin => plugin.name)).toEqual(['vite:vue'])
    expect(config.server.proxy['/api']).toMatchObject({
      target: 'http://localhost:8123',
      changeOrigin: true,
    })
  })
})
