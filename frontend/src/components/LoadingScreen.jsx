/** Full-screen blue loading screen with doodle confetti and mascot animals. */
export default function LoadingScreen({ message = 'LoaDinG' }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--color-sky)' }}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(LOADING_DOODLE_SVG)}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '280px 280px',
        }}
      />

      <h1 className="font-display relative z-10 text-5xl font-bold tracking-wide text-white sm:text-6xl">
        {message}
      </h1>

      <div className="relative z-10 mt-10 flex items-end gap-8">
        <AnimalIcon type="cat" className="animate-loading-bounce h-14 w-14 text-white" />
        <AnimalIcon type="frog" className="animate-loading-bounce-delay-1 h-16 w-16 text-white" />
        <AnimalIcon type="dog" className="animate-loading-bounce-delay-2 h-14 w-14 text-white" />
      </div>
    </div>
  )
}

function AnimalIcon({ type, className }) {
  const paths = {
    cat: (
      <>
        <circle cx="32" cy="28" r="18" fill="currentColor" />
        <polygon points="18,16 22,28 14,24" fill="currentColor" />
        <polygon points="46,16 42,28 50,24" fill="currentColor" />
        <circle cx="26" cy="26" r="2" fill="#5D94D6" />
        <circle cx="38" cy="26" r="2" fill="#5D94D6" />
        <path d="M28 32 Q32 36 36 32" fill="none" stroke="#5D94D6" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="14" y1="30" x2="22" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="14" y1="34" x2="22" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="42" y1="32" x2="50" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="42" y1="34" x2="50" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    frog: (
      <>
        <circle cx="32" cy="30" r="20" fill="currentColor" />
        <circle cx="24" cy="22" r="7" fill="currentColor" />
        <circle cx="40" cy="22" r="7" fill="currentColor" />
        <circle cx="24" cy="22" r="3" fill="#5D94D6" />
        <circle cx="40" cy="22" r="3" fill="#5D94D6" />
        <ellipse cx="32" cy="38" rx="6" ry="4" fill="#5D94D6" />
        <path d="M38 40 Q44 44 42 48" fill="none" stroke="#FF85A2" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
    dog: (
      <>
        <circle cx="32" cy="30" r="18" fill="currentColor" />
        <ellipse cx="18" cy="32" rx="8" ry="12" fill="currentColor" />
        <ellipse cx="46" cy="32" rx="8" ry="12" fill="currentColor" />
        <circle cx="26" cy="26" r="2" fill="#5D94D6" />
        <circle cx="38" cy="26" r="2" fill="#5D94D6" />
        <ellipse cx="32" cy="32" rx="4" ry="3" fill="#5D94D6" />
        <path d="M28 36 Q32 40 36 36" fill="none" stroke="#5D94D6" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  }

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {paths[type]}
    </svg>
  )
}

const LOADING_DOODLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" viewBox="0 0 280 280">
  <path d="M30 50 L45 75 L15 75 Z" fill="none" stroke="#FF85A2" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="100" cy="40" r="10" fill="none" stroke="#4ABFFF" stroke-width="2"/>
  <circle cx="180" cy="60" r="5" fill="#FFB199"/>
  <path d="M240 30 Q255 50 240 70" fill="none" stroke="#FF85A2" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M60 120 Q75 105 90 120" fill="none" stroke="#4ABFFF" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="150" cy="130" r="6" fill="#FF85A2"/>
  <path d="M210 110 L225 135 L195 135 Z" fill="none" stroke="#FFB199" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M20 190 Q35 175 50 190" fill="none" stroke="#FFB199" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="110" cy="200" r="8" fill="none" stroke="#FF85A2" stroke-width="2"/>
  <path d="M170 180 Q185 200 170 220" fill="none" stroke="#4ABFFF" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="250" cy="190" r="4" fill="#4ABFFF"/>
  <path d="M40 250 L55 275 L25 275 Z" fill="none" stroke="#4ABFFF" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="130" cy="260" r="5" fill="#FFB199"/>
  <path d="M200 240 Q215 260 200 280" fill="none" stroke="#FF85A2" stroke-width="2.5" stroke-linecap="round"/>
</svg>`
