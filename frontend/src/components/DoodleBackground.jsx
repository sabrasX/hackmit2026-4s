/** Hand-drawn doodle artwork on cream, fixed behind the page content. */
export default function DoodleBackground({ children, className = '' }) {
  return (
    <div className={`relative min-h-dvh ${className}`}>
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
        style={{
          backgroundColor: 'var(--color-cream)',
          backgroundImage: 'url("/background.webp")',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
