// Variable-width histogram: bar height is the struggle score, bar width is the
// share of the session's time that word took, so the bars together fill the full
// width with no gaps. Recharts' categorical axis forces equal-width bands, which
// is what leaves gaps between bars, so this is laid out directly instead.

import { useState } from 'react'

const GRID_LINES = [0, 25, 50, 75, 100]

function barColor(score) {
  if (score < 40) return '#6bcb77'
  if (score <= 70) return '#fadbb6'
  return '#ff85a2'
}

function label(score) {
  if (score < 40) return 'Calm'
  if (score <= 70) return 'Some struggle'
  return 'Needs support'
}

export default function StruggleChart({ words = [] }) {
  const [hovered, setHovered] = useState(null)

  if (!words.length) {
    return <p className="text-center text-slate-500">No word data yet.</p>
  }

  // A word with no recorded time still needs some width, or it vanishes.
  const widthOf = (w) => Math.max(w.seconds ?? 0, 0.2)

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

        <div className="relative h-64 flex-1 sm:h-72">
          {GRID_LINES.map((v) => (
            <div
              key={v}
              className="absolute inset-x-0 border-t border-slate-100"
              style={{ bottom: `${v}%` }}
            />
          ))}

          <div className="absolute inset-0 flex items-end">
            {words.map((w, i) => {
              const height = Math.max(w.score, 1)
              return (
                <div
                  key={`${w.word}-${i}`}
                  className={`relative flex h-full items-end rounded-sm px-[3px] transition-colors ${
                    hovered === i ? 'bg-slate-400/15' : ''
                  }`}
                  style={{ flexGrow: widthOf(w), flexBasis: 0 }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="w-full rounded-t-[3px] transition-all"
                    style={{ height: `${height}%`, background: barColor(w.score) }}
                  />

                  {hovered === i && (
                    <div
                      className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border-2 bg-white px-3 py-2 text-left shadow-lg"
                      style={{
                        borderColor: '#b8c9df',
                        // Sits just above the bar, but never off the top of the chart.
                        bottom: `min(calc(${height}% + 10px), calc(100% - 5.5rem))`,
                      }}
                    >
                      <p className="font-display text-sm font-bold text-sky-700">{w.word}</p>
                      <p className="text-xs text-slate-600">
                        Struggle score: <span className="font-mono font-bold">{w.score}</span>
                      </p>
                      <p className="text-xs text-slate-600">
                        Time: <span className="font-mono font-bold">{w.seconds ?? 0}s</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: barColor(w.score) }}
                        />
                        {label(w.score)}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex pl-8">
        {words.map((w, i) => (
          <div
            key={`${w.word}-label-${i}`}
            className="min-w-0 px-1 pt-2 text-center"
            style={{ flexGrow: widthOf(w), flexBasis: 0 }}
          >
            <p className="truncate text-sm text-slate-600">{w.word}</p>
            <p className="text-xs text-slate-400">{w.seconds ?? 0}s</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-xs text-slate-400">
        Bar height = struggle score · bar width = time spent on the word
      </p>

      <div className="mt-3 flex flex-wrap justify-center gap-6 text-sm text-slate-500">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#6bcb77' }} />
          Calm
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#fadbb6' }} />
          Some struggle
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#ff85a2' }} />
          Needs support
        </span>
      </div>
    </div>
  )
}
