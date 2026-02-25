import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
        timeout: 300000,       // 5 min – podcast generation is slow
      },
      '/leccap': {
        target: 'https://leccap.engin.umich.edu',
        changeOrigin: true,
        secure: true,
        headers: {
          Referer: 'https://leccap.engin.umich.edu/',
        },
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Strip headers that block iframe embedding
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
          });
        },
      },
    },
  },
})