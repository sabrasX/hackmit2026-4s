// Line graph of the Arduino stress reading over the session. Each segment of the
// stress line is coloured by the processed state at that moment (green = calm,
// red = stressed). A second, blue line shows confidence in that classification.
// Drawn directly in SVG so the line can change colour per segment.
//
// Expected sample shape (from the Arduino pipeline once it is wired up):
//   { t: seconds since session start, stress: 0-100, confidence: 0-100, state: 'calm' | 'stressed' }

import { useState } from 'react'

const CALM = '#6bcb77'
const STRESSED = '#ff6b6b'
const CONFIDENCE = '#5d94d6'
const GRID_LINES = [0, 25, 50, 75, 100]

const W = 600
const H = 200

function colorFor(state) {
  return state === 'stressed' ? STRESSED : CALM
}

// Until the Arduino is hooked up, fake a stress trace from the per-word scores so
// the chart has something to show.
export function samplesFromWords(words = []) {
  const out = []
  let t = 0
  words.forEach((w, wi) => {
    const dur = Math.max(w.seconds ?? 0, 0.5)
    const steps = Math.max(2, Math.round(dur * 2))
    const last = wi === words.length - 1
    // Each word owns its start boundary; the final word also emits the session end.
    for (let i = 0; i < steps + (last ? 1 : 0); i++) {
      const wobble = Math.sin((t + i) * 1.7) * 6
      const stress = Math.min(100, Math.max(0, w.score + wobble))
      out.push({
        t: +(t + (dur * i) / steps).toFixed(2),
        stress: Math.round(stress),
        confidence: Math.round(Math.min(100, 60 + Math.abs(stress - 50) * 0.8)),
        state: stress >= 50 ? 'stressed' : 'calm',
      })
    }
    t += dur
  })
  return out
}

export default function CalmStressChart({ samples = [] }) {
  const [hovered, setHovered] = useState(null)

  if (samples.length < 2) {
    return <p className="text-center text-slate-500">Waiting for sensor data…</p>
  }

  const tMax = samples[samples.length - 1].t || 1
  const tMin = samples[0].t
  const x = (t) => ((t - tMin) / (tMax - tMin || 1)) * W
  const y = (v) => (1 - v / 100) * H

  const confidencePath = samples
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${x(s.t).toFixed(1)},${y(s.confidence ?? 0).toFixed(1)}`)
    .join(' ')

  const current = hovered != null ? samples[hovered] : null

  return (
    <div className="w-full">
      <div className="flex">
        <div className="relative w-8 shrink-0">
          {GRID_LINES.map((v) => (
            <span
              key={v}
              className="absolute right-1 -translate-y-1/2 text-xs text-slate-400"
              style={{ bottom: `${v}%` }}
            >
              {v}
            </span>
          ))}
        </div>

        <div className="relative h-48 flex-1 sm:h-52">
          {GRID_LINES.map((v) => (
            <div
              key={v}
              className="absolute inset-x-0 border-t border-slate-100"
              style={{ bottom: `${v}%` }}
            />
          ))}

          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            onMouseLeave={() => setHovered(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const frac = (e.clientX - rect.left) / rect.width
              const t = tMin + frac * (tMax - tMin)
              let best = 0
              for (let i = 1; i < samples.length; i++) {
                if (Math.abs(samples[i].t - t) < Math.abs(samples[best].t - t)) best = i
              }
              setHovered(best)
            }}
          >
            <path
              d={confidencePath}
              fill="none"
              stroke={CONFIDENCE}
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {samples.slice(1).map((s, i) => {
              const prev = samples[i]
              return (
                <line
                  key={i}
                  x1={x(prev.t)}
                  y1={y(prev.stress)}
                  x2={x(s.t)}
                  y2={y(s.stress)}
                  stroke={colorFor(s.state)}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}

            {current && (
              <line
                x1={x(current.t)}
                x2={x(current.t)}
                y1={0}
                y2={H}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {current && (
            <div
              className="pointer-events-none absolute top-2 z-10 whitespace-nowrap rounded-xl border-2 bg-white px-3 py-2 text-left shadow-lg"
              style={{
                borderColor: '#b8c9df',
                left: `${((current.t - tMin) / (tMax - tMin || 1)) * 100}%`,
                transform: `translateX(${current.t - tMin > (tMax - tMin) / 2 ? 'calc(-100% - 10px)' : '10px'})`,
              }}
            >
              <p className="font-display text-sm font-bold text-sky-700">{current.t}s</p>
              <p className="text-xs text-slate-600">
                Stress: <span className="font-mono font-bold">{current.stress}</span>
              </p>
              <p className="text-xs text-slate-600">
                Confidence: <span className="font-mono font-bold">{current.confidence ?? '–'}</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: colorFor(current.state) }}
                />
                {current.state === 'stressed' ? 'Stressed' : 'Calm'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between pl-8 pt-2 text-xs text-slate-400">
        <span>{tMin}s</span>
        <span>{Math.round(tMax)}s</span>
      </div>

      <p className="mt-3 text-center text-xs text-slate-400">
        Stress reading over time · line colour = calm / stressed state
      </p>

      <div className="mt-3 flex flex-wrap justify-center gap-6 text-sm text-slate-500">
        <span className="flex items-center gap-2">
          <span className="inline-block h-1 w-5 rounded-full" style={{ background: CALM }} />
          Calm
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-1 w-5 rounded-full" style={{ background: STRESSED }} />
          Stressed
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-0 w-5 border-t-2 border-dashed"
            style={{ borderColor: CONFIDENCE }}
          />
          Confidence
        </span>
      </div>
    </div>
  )
}
