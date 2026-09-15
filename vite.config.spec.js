import { afterEach, describe, expect, it, vi } from 'vitest'
import createViteConfig from './vite.config.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('vite runtime mode', () => {
  it('uses the real backend proxy when mock mode is not explicitly enabled', () => {
    vi.stubEnv('VITE_USE_MOCK', '')

    const config = createViteConfig({ mode: 'development' })

    expect(config.plugins.map(plugin => plugin.name)).not.toContain('dao-index-mock')
    expect(config.server.proxy['/api']).toMatchObject({
      target: 'http://localhost:8123',
      changeOrigin: true,
    })
  })

  it('enables mock middleware only when explicitly requested', () => {
    vi.stubEnv('VITE_USE_MOCK', '1')

    const config = createViteConfig({ mode: 'development' })

    expect(config.plugins.map(plugin => plugin.name)).toContain('dao-index-mock')
    expect(config.server).toEqual({})
  })
})
