import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@elevenlabs/client/internal',
        replacement: path.resolve(
          __dirname,
          'node_modules/@elevenlabs/client/dist/internal.js',
        ),
      },
      {
        find: '@elevenlabs/client',
        replacement: path.resolve(
          __dirname,
          'node_modules/@elevenlabs/client/dist/platform/web/index.js',
        ),
      },
    ],
    conditions: ['browser', 'import', 'module', 'default'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
