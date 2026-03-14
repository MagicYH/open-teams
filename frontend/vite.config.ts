import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd() + '/../', '')
  const port = parseInt(env.FRONTEND_PORT || '5173', 10)
  const backendPort = parseInt(env.BACKEND_PORT || '8000', 10)

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: port,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
          timeout: 600000,
          proxyTimeout: 600000
        },
        '/ws': {
          target: `ws://localhost:${backendPort}`,
          ws: true
        }
      }
    }
  }
})
