import { execFile } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
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
    execFile('adb', ['pull', DEVICE_EXPORTS, EXPORTS_DIR], { timeout: 4000 }, (err) => done(!err))
  })
}

// { filename -> contents } of every export currently on disk.
function readExports() {
  const out = new Map()
  let files
  try {
    files = readdirSync(EXPORTS_DIR).filter((f) => /^session_.*\.json$/.test(f))
  } catch {
    return out
  }
  for (const f of files) {
    try {
      out.set(f, readFileSync(join(EXPORTS_DIR, f), 'utf8'))
    } catch {
      // skip files removed/unreadable mid-scan
    }
  }
  return out
}

// The running monitor is the only thing still rewriting its file, so a file the
// pull changed/added is the current session regardless of the board's clock.
// Otherwise fall back to the timestamped filename (session_YYYYMMDD_HHMMSS_mode.json).
function latestExport(before, after) {
  const changed = [...after.keys()].filter((f) => before.get(f) !== after.get(f))
  const pool = changed.length ? changed : [...after.keys()]
  if (!pool.length) return null
  pool.sort((a, b) => b.localeCompare(a))
  return after.get(pool[0])
}

// GET /api/heart-session -> newest Arduino stress-checker export (dev server only).
// Tries `adb pull` first so a plugged-in board is read live; falls back to
// whatever is already in heartMonitor/exports. 404 when nothing is available.
// X-Heart-Source tells the client whether the file came from a live pull or cache.
function heartMonitorBridge() {
  return {
    name: 'heart-monitor-bridge',
    configureServer(server) {
      server.middlewares.use('/api/heart-session', async (_req, res) => {
        const before = readExports()
        const live = await adbPull()
        const body = latestExport(before, readExports())
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Heart-Source', live ? 'live' : 'cache')
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
