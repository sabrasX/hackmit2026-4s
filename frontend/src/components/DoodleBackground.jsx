/** Tiled hand-drawn doodle pattern on cream — matches the app theme background. */
export default function DoodleBackground({ children, className = '' }) {
  return (
    <div className={`relative min-h-dvh ${className}`}>
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundColor: 'var(--color-cream)',
          backgroundImage: 'url("/background.webp")',
          backgroundRepeat: 'repeat',
          backgroundSize: '356px 267px',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
