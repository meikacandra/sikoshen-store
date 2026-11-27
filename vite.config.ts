/// <reference types="vitest" />
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function autoStartBackendPlugin(mode: string): Plugin {
  const appTarget = mode === 'mysql' ? 'mysql_app:app' : 'main:app'
  return {
    name: 'auto-start-fastapi-backend',
    configureServer() {
      const probe = new net.Socket()
      probe.setTimeout(600)
      probe.once('connect', () => {
        probe.destroy()
      })
      const startBackend = () => {
        probe.destroy()
        const pythonExe = path.resolve(__dirname, 'backend/venv/Scripts/python.exe')
        const child = spawn(
          pythonExe,
          ['-m', 'uvicorn', appTarget, '--app-dir', 'backend', '--host', '127.0.0.1', '--port', '8000'],
          { cwd: __dirname, stdio: 'ignore', detached: true, windowsHide: true },
        )
        child.unref()
      }
      probe.once('error', startBackend)
      probe.once('timeout', startBackend)
      probe.connect(8000, '127.0.0.1')
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), autoStartBackendPlugin(mode)],
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
