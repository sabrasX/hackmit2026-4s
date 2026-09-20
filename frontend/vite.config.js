import { execFile } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Where heartMonitor/pull_json.bat drops the Arduino exports, and where they
// live on the UNO Q (see heartMonitor/deploy.bat).
const EXPORTS_DIR = fileURLToPath(new URL('../heartMonitor/exports', import.meta.url))
const DEVICE_EXPORTS = '/home/arduino/ArduinoApps/heart-rate1/python/exports/.'

function adbPull() {
  return new Promise((done) => {
    execFile('adb', ['pull', DEVICE_EXPORTS, EXPORTS_DIR], { timeout: 4000 }, () => done())
  })
}

function latestExport() {
  let files
  try {
    files = readdirSync(EXPORTS_DIR).filter((f) => /^session_.*\.json$/.test(f))
  } catch {
    return null
  }
  if (!files.length) return null
  files.sort((a, b) => statSync(join(EXPORTS_DIR, b)).mtimeMs - statSync(join(EXPORTS_DIR, a)).mtimeMs)
  return readFileSync(join(EXPORTS_DIR, files[0]), 'utf8')
}

// GET /api/heart-session -> newest Arduino stress-checker export (dev server only).
// Tries `adb pull` first so a plugged-in board is read live; falls back to
// whatever is already in heartMonitor/exports. 404 when nothing is available.
function heartMonitorBridge() {
  return {
    name: 'heart-monitor-bridge',
    configureServer(server) {
      server.middlewares.use('/api/heart-session', async (_req, res) => {
        await adbPull()
        const body = latestExport()
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        if (!body) {
          res.statusCode = 404
          res.end('{"error":"no heart monitor export found"}')
          return
        }
        res.end(body)
      })
    },
  }
}

// Vite config: React + Tailwind v4 plugin. Dev server runs on http://localhost:5173
export default defineConfig({
  plugins: [react(), tailwindcss(), heartMonitorBridge()],
})
