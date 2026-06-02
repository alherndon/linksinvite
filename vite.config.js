import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api requests to vercel dev (port 3000) during local development.
    // Run `npm run dev:api` in one terminal and `npm run dev` in another,
    // or just use `npm run dev:full` to run vercel dev which serves both.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
