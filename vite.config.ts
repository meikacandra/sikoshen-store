/// <reference types="vitest" />
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Saat `npm run dev`, nyalakan backend FastAPI otomatis jika port 8000 belum dipakai.
 * Tidak berjalan saat `npm test` / build, dan dilewati bila venv belum dibuat.
 */
function autoStartBackendPlugin(): Plugin {
  return {
    name: 'auto-start-fastapi-backend',
    apply: 'serve',
    configureServer() {
      if (process.env.VITEST) return
      const pythonExe = process.platform === 'win32'
        ? path.resolve(__dirname, 'backend/venv/Scripts/python.exe')
        : path.resolve(__dirname, 'backend/venv/bin/python')
      if (!fs.existsSync(pythonExe)) return
      const probe = new net.Socket()
      probe.setTimeout(600)
      probe.once('connect', () => {
        probe.destroy()
      })
      const startBackend = () => {
        probe.destroy()
        const child = spawn(
          pythonExe,
          ['-m', 'uvicorn', 'main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', '8000'],
          { cwd: __dirname, stdio: 'ignore', detached: true, windowsHide: true },
        )
        child.on('error', () => {})
        child.unref()
      }
      probe.once('error', startBackend)
      probe.once('timeout', startBackend)
      probe.connect(8000, '127.0.0.1')
    },
  }
}

export default defineConfig(() => ({
  plugins: [react(), autoStartBackendPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: { environment: 'node' },
}))
