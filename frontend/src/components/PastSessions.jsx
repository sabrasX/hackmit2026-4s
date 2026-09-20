// A child's previous writing sessions. Doubles as the history the scorer reads
// to learn their normal writing pace (see paceFromSessions in lib/scoring.js).

function formatDate(date) {
  if (!date) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function totalSeconds(words = []) {
  return words.reduce((sum, w) => sum + (w.seconds ?? 0), 0)
}

export default function PastSessions({ sessions }) {
  if (sessions === null) {
    return (
      <section className="mt-10">
        <h2 className="font-display mb-4 text-2xl font-bold text-sky-700">Your practice history</h2>
        <p className="text-slate-400">Loading…</p>
      </section>
    )
  }

  if (!sessions.length) {
    return (
      <section className="mt-10">
        <h2 className="font-display mb-4 text-2xl font-bold text-sky-700">Your practice history</h2>
        <div className="card-doodle p-6 text-center">
          <img src="/rabbit.png" alt="" className="mx-auto h-24 w-24 object-contain" />
          <p className="mt-3 text-slate-500">
            No sessions yet - finish a writing session and it will show up here!
          </p>
        </div>
      </section>
    )
  }

  const best = Math.min(...sessions.map((s) => s.overallScore ?? 100))

  return (
    <section className="mt-10">
      <h2 className="font-display mb-4 text-2xl font-bold text-sky-700">Your practice history</h2>

      <div className="flex flex-col gap-3">
        {sessions.map((s) => {
          const seconds = Math.round(totalSeconds(s.words))
          return (
            <div key={s.id} className="card-doodle flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-sky-700">
                  {(s.words ?? []).map((w) => w.word).join(' ') || 'Writing session'}
                </p>
                <p className="text-sm text-slate-400">
                  {formatDate(s.createdAt)}
                  {seconds > 0 && ` · ${seconds}s`}
                  {s.overallScore === best && sessions.length > 1 && ' · 🏅 your best'}
                </p>
              </div>

              <div className="w-16 text-right">
                <p className="font-display text-2xl font-bold text-sky-700">{s.overallScore}</p>
                <p className="text-xs text-slate-400">score</p>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-center text-xs text-slate-400">
        Lower scores mean less struggle. Your pace from these sessions is used to judge future ones
        fairly.
      </p>
    </section>
  )
}
