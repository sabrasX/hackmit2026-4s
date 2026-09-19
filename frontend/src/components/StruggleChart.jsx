import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function barColor(score) {
  if (score < 40) return '#6bcb77'
  if (score <= 70) return '#fadbb6'
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
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontFamily: '"Lemon Slice", Chewy, cursive', fontSize: 14, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontFamily: '"Lemon Slice", Chewy, cursive', fontSize: 12, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            label={{
              value: 'Struggle score',
              angle: -90,
              position: 'insideLeft',
              style: { fontFamily: '"Lemon Slice", Chewy, cursive', fill: '#94a3b8', fontSize: 12 },
            }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '1rem',
              border: '2px solid #b8c9df',
              fontFamily: '"Lemon Slice", Chewy, cursive',
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
    </div>
  )
}
