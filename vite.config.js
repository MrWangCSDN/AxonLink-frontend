import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'AXON_REAL_API_TARGET')
  const apiTarget = process.env.AXON_REAL_API_TARGET || env.AXON_REAL_API_TARGET || 'http://localhost:8123'
  return {
    plugins: [vue()],
    build: {
      outDir: path.resolve(__dirname, '../axon-link-server/src/main/resources/static'),
      emptyOutDir: true,
      chunkSizeWarningLimit: 2048,
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
