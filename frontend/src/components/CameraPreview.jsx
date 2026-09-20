// Debug/demo view of what the vision server is actually analysing: the frame it
// processed (with the hand landmarks drawn on by Python) plus the signals it
// derived from it. Run the server with --video to get the picture; without it
// the signals still show and only the image is missing.

function Pill({ label, on, tone = 'alert' }) {
  const onStyle = tone === 'good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
  return (
    <span
      className={`rounded-full px-4 py-1.5 text-sm font-bold ${
        on ? onStyle : 'bg-slate-100 text-slate-400'
      }`}
    >
      {label}
    </span>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-600">{value}</span>
    </div>
  )
}

function num(v, places = 2) {
  return typeof v === 'number' ? v.toFixed(places) : '—'
}

export default function CameraPreview({ status, rollingScore = 0, connected }) {
  return (
    <div className="card-doodle p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-sky-700">What the camera sees</h3>
        <span className="text-sm text-slate-400">{connected ? 'live' : 'disconnected'}</span>
      </div>

      {/* Capped against the viewport so the readouts below stay on screen. */}
      <div className="flex aspect-video max-h-[42vh] w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-900">
        {status?.frame ? (
          <img
            src={status.frame}
            alt="Camera view with detected hand"
            className="h-full w-full object-contain"
          />
        ) : (
          <p className="px-4 text-center text-sm text-slate-400">
            {connected
              ? 'Restart the vision server with --video to see the picture'
              : 'Waiting for the vision server…'}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-sm text-slate-400">Live struggle score</span>
          <p className="font-display text-4xl font-bold text-sky-700">{rollingScore}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill label="HAND" on={status?.handVisible} tone="good" />
          <Pill label="STOPPED" on={status?.stopped} />
          <Pill label="POSTURE" on={status?.badPosture || status?.palmFacingAway} />
          <Pill label="STRUGGLING" on={status?.struggling} />
        </div>
      </div>

      {status?.reasons?.length > 0 && (
        <p className="mt-3 text-base font-bold text-red-600">{status.reasons.join(' · ')}</p>
      )}

      <div className="mt-3 grid gap-x-8 text-sm sm:grid-cols-2">
        {typeof status?.struggleScore === 'number' && (
          <Stat label="server score" value={num(status.struggleScore, 1)} />
        )}
        <Stat label="stillExtent" value={num(status?.stillExtent)} />
        <Stat label="articulation" value={num(status?.articulation)} />
        <Stat label="fingerExtension" value={num(status?.fingerExtension, 0)} />
        <Stat label="extensionExcess" value={num(status?.extensionExcess, 0)} />
        <Stat label="calibrated" value={status ? String(!!status.calibrated) : '—'} />
      </div>
    </div>
  )
}
