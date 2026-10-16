import { afterEach, describe, expect, it, vi } from 'vitest'
import createViteConfig from './vite.config.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('vite runtime mode', () => {
  it.each(['development', 'production'])('uses the real backend even if the removed mock flag is set in %s mode', mode => {
    vi.stubEnv('VITE_USE_MOCK', '1')

    const config = createViteConfig({ mode })

    expect(config.plugins.map(plugin => plugin.name)).toEqual(['vite:vue'])
    expect(config.server.proxy['/api']).toMatchObject({
      target: 'http://localhost:8123',
      changeOrigin: true,
    })
  })
})
