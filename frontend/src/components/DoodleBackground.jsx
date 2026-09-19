/** Tiled hand-drawn doodle pattern on cream — matches the app theme background. */
export default function DoodleBackground({ children, className = '' }) {
  return (
    <div className={`relative min-h-dvh ${className}`}>
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden="true"
        style={{
          backgroundColor: 'var(--color-cream)',
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(DOODLE_SVG)}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '320px 320px',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

const DOODLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="320" height="320" fill="#FFF9E8"/>
  <path d="M40 60 L55 85 L25 85 Z" fill="none" stroke="#B8C9DF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="120" cy="45" r="8" fill="none" stroke="#F4C2C2" stroke-width="2"/>
  <circle cx="200" cy="70" r="4" fill="#F4C2C2"/>
  <path d="M260 40 Q275 55 260 70" fill="none" stroke="#FADBB6" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M80 130 Q95 115 110 130 Q95 145 80 130" fill="none" stroke="#B8C9DF" stroke-width="2" stroke-linecap="round"/>
  <circle cx="170" cy="140" r="12" fill="none" stroke="#FADBB6" stroke-width="2"/>
  <path d="M240 120 L255 145 L225 145 Z" fill="none" stroke="#F4C2C2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="300" cy="130" r="5" fill="#B8C9DF"/>
  <path d="M30 200 Q45 185 60 200" fill="none" stroke="#F4C2C2" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="100" cy="210" r="6" fill="none" stroke="#B8C9DF" stroke-width="2"/>
  <path d="M150 190 Q165 210 150 230" fill="none" stroke="#FADBB6" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M220 200 L235 225 L205 225 Z" fill="none" stroke="#B8C9DF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="290" cy="210" r="4" fill="#FADBB6"/>
  <path d="M50 280 Q65 265 80 280" fill="none" stroke="#B8C9DF" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="140" cy="290" r="8" fill="none" stroke="#F4C2C2" stroke-width="2"/>
  <path d="M210 270 Q225 290 210 310" fill="none" stroke="#F4C2C2" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="280" cy="280" r="5" fill="#F4C2C2"/>
</svg>`
