import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/finalstock/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/finalstock\/api/, '/api')
      }
    }
  },
  build: {
    outDir: 'dist',
    base: '/finalstock/'
  },
  base: '/finalstock/'
})
