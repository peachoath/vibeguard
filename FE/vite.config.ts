import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // BE(Spring Boot)로 API/SSE 프록시 — dev 편의
      '/api': 'http://localhost:8080',
      // OAuth 시작/콜백도 BE로 프록시. FE의 /login 라우트와 충돌하지 않도록
      // 콜백은 /login/oauth2 만 프록시한다(Spring: /login/oauth2/code/*).
      '/oauth2': 'http://localhost:8080',
      '/login/oauth2': 'http://localhost:8080',
    },
  },
})
