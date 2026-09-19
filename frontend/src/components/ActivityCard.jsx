export default function ActivityCard({ title, icon, description, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`card-doodle group relative flex w-full flex-col items-center gap-4 p-8 text-center transition-all duration-200 ${
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:translate-y-0.5'
      }`}
    >
      {disabled && (
        <span className="absolute right-4 top-4 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Coming soon
        </span>
      )}
      <span className="text-6xl" aria-hidden="true">
        {icon}
      </span>
      <div>
        <h3 className="font-display text-2xl font-bold text-sky-700">{title}</h3>
        {description && <p className="mt-2 text-base text-slate-500">{description}</p>}
      </div>
      {!disabled && (
        <span className="font-display mt-2 text-sm font-semibold text-sky-500 opacity-0 transition-opacity group-hover:opacity-100">
          Tap to start →
        </span>
      )}
    </button>
  )
}
