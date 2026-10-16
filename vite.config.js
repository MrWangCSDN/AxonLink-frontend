import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(() => ({
  plugins: [vue()],
  build: {
    outDir: path.resolve(__dirname, '../axon-link-server/src/main/resources/static'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2048,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8123',
        changeOrigin: true,
      },
    },
  },
}))
