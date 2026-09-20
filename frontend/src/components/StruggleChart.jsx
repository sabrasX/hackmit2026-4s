import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { WEIGHTS, SUPPORT_LEVELS } from '../config.js'

const SOME_STRUGGLE = SUPPORT_LEVELS[0].minScore
const NEEDS_SUPPORT = SUPPORT_LEVELS[SUPPORT_LEVELS.length - 1].minScore

const PART_LABELS = {
  stopped: 'pen stopped',
  wrongPosition: 'hand out of position',
  fidget: 'restless fingers',
  handMissing: 'hand out of view',
}

function barColor(score) {
  if (score < SOME_STRUGGLE) return '#6bcb77'
  if (score < NEEDS_SUPPORT) return '#fadbb6'
  return '#ff85a2'
}

export default function StruggleChart({ words = [] }) {
  const data = words.map((w) => ({
    name: w.word,
    score: w.score,
  }))

  if (!data.length) {
    return (
      <p className="text-center text-slate-500">No word data yet.</p>
    )
  }

  return (
    <div className="w-full">
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fontFamily: 'Nunito', fontSize: 14, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontFamily: 'Nunito', fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={70}
              label={{
                value: 'Struggle score',
                angle: -90,
                position: 'insideLeft',
                offset: 16,
                style: {
                  fontFamily: 'Nunito',
                  fill: '#94a3b8',
                  fontSize: 12,
                  textAnchor: 'middle',
                },
              }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '1rem',
                border: '2px solid #b8c9df',
                fontFamily: 'Nunito',
              }}
              formatter={(value) => [`${value}`, 'Score']}
            />
            <Bar dataKey="score" radius={[12, 12, 0, 0]} maxBarSize={64}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={barColor(entry.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex justify-center gap-6 text-sm text-slate-500">
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

      <p className="mt-4 text-sm leading-relaxed text-slate-500">
        <strong className="text-slate-600">How the struggle score is made:</strong> the camera
        tracks the writing hand about five times a second and the vision AI turns each frame into a
        score out of 100 &mdash;{' '}
        {Object.entries(WEIGHTS)
          .map(([name, weight]) => `${PART_LABELS[name]} ${Math.round(weight * 100)}`)
          .join(', ')}{' '}
        points. The warm-up measures how this child writes when they are calm, and that baseline is
        discounted; words that take much longer than usual add up to 20 points. Each bar is the
        average for that word: low and green means calm writing, high and pink means support was
        needed.
      </p>
    </div>
  )
}
