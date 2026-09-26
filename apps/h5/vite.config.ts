import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // 生产部署在 https://www.ruohao.com.cn/english-study/ 子路径下；开发时仍在根路径
  base: command === 'build' ? '/english-study/' : '/',
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      // dev base 为 '/'，h5 实际请求 /api
      '/api': 'http://127.0.0.1:3000',
      // 生产路径 /english-study/api 也能在 dev 下直连（模拟线上 nginx 反代）
      '/english-study/api': {
        target: 'http://127.0.0.1:3000',
        rewrite: (p) => p.replace(/^\/english-study/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@study/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url),
      ),
    },
  },
}))
