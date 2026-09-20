// End-of-session readout from the Arduino heart monitor. Renders nothing at all
// when the board wasn't connected, so a sensor-less session looks normal.

function Stat({ label, value, unit }) {
  return (
    <div className="card-doodle px-5 py-4 text-center">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="font-display mt-1 text-3xl font-bold text-sky-700">
        {value}
        {unit && <span className="ml-1 text-base font-semibold text-slate-400">{unit}</span>}
      </p>
    </div>
  )
}

export default function HeartSummary({ heart }) {
  if (!heart) return null

  const { averageBpm, minBpm, maxBpm, baselineBpm, stressedPercent } = heart
  const aboveBaseline =
    averageBpm != null && baselineBpm != null ? Math.round(averageBpm - baselineBpm) : null

  return (
    <div className="mb-8">
      <h2 className="font-display mb-4 text-xl font-bold text-sky-700">Your heart while writing</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {averageBpm != null && <Stat label="Average" value={averageBpm} unit="bpm" />}
        {minBpm != null && maxBpm != null && (
          <Stat label="Range" value={`${minBpm}–${maxBpm}`} unit="bpm" />
        )}
        {baselineBpm != null && <Stat label="Your resting" value={baselineBpm} unit="bpm" />}
        {stressedPercent != null && <Stat label="Time stressed" value={stressedPercent} unit="%" />}
      </div>

      {aboveBaseline != null && (
        <p className="mt-3 text-center text-sm text-slate-500">
          {aboveBaseline > 5
            ? `Your heart beat about ${aboveBaseline} bpm faster than usual while writing.`
            : aboveBaseline < -5
              ? 'Your heart was calmer than usual while writing.'
              : 'Your heart stayed close to its usual rhythm.'}
        </p>
      )}
    </div>
  )
}
