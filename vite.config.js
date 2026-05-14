import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { daoIndexMockPlugin } from './mock/daoIndexMockServer.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // VITE_USE_MOCK=1 时启用 Vite 中间件 mock；默认开启，方便本地无后端预览
  const useMock = (env.VITE_USE_MOCK ?? '1') !== '0'

  return {
    plugins: [vue(), useMock && daoIndexMockPlugin()].filter(Boolean),
    build: {
      outDir: path.resolve(__dirname, '../axon-link-server/src/main/resources/static'),
      emptyOutDir: true,
      chunkSizeWarningLimit: 2048,
    },
    server: useMock
      ? {} // mock 模式下不需要后端代理；中间件直接拦截 /api/*
      : {
          proxy: {
            '/api': {
              target: 'http://localhost:8123',
              changeOrigin: true,
            },
          },
        },
  }
})
