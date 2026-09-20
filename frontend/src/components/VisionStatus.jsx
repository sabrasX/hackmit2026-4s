const signalLabels = [
  ['stopped', 'Pen stopped'],
  ['palmFacingAway', 'Palm away'],
  ['badPosture', 'Wrong position'],
]

export default function VisionStatus({ status, connected, isMock }) {
  return (
    <section className="rounded-2xl border-2 border-sky-100 bg-white/80 p-4 shadow-sm" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display font-bold text-sky-700">Live Vision AI</h2>
          <p className="text-xs text-slate-400">The camera signals feeding this word&apos;s score</p>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {connected ? (isMock ? 'Demo stream' : 'Camera stream') : 'Waiting for vision server'}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {signalLabels.map(([key, label]) => (
          <div key={key} className={`rounded-lg px-3 py-2 ${status?.[key] ? 'bg-rose-100 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>
            <span className="block text-xs">{label}</span>
            <strong>{status?.[key] ? 'Detected' : 'Clear'}</strong>
          </div>
        ))}
        <div className={`rounded-lg px-3 py-2 ${status?.handVisible === false ? 'bg-rose-100 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>
          <span className="block text-xs">Hand in frame</span>
          <strong>{status?.handVisible === false ? 'No' : 'Yes'}</strong>
        </div>
      </div>
      {status?.reasons?.length > 0 && (
        <p className="mt-3 text-xs text-rose-600">Signals: {status.reasons.join(', ')}</p>
      )}
    </section>
  )
}