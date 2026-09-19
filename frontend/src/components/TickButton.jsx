import { useRef, useState } from 'react'

function playSuccessSound() {
  const audio = new Audio('/sounds/success.mp3')
  audio.volume = 0.5
  audio.play().catch(() => {})
}

export default function TickButton({ onClick, label = 'Done!' }) {
  const [bouncing, setBouncing] = useState(false)
  const lastTap = useRef(0)

  const handleClick = () => {
    const now = Date.now()
    if (now - lastTap.current < 1000) return
    lastTap.current = now

    setBouncing(true)
    playSuccessSound()
    onClick?.()
    setTimeout(() => setBouncing(false), 400)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-200 sm:h-28 sm:w-28 ${
        bouncing ? 'scale-110' : 'hover:scale-105 active:scale-95'
      }`}
      style={{
        background: 'linear-gradient(180deg, var(--color-success) 0%, var(--color-success-dark) 100%)',
        boxShadow: '0 6px 0 0 #388e3c',
      }}
      aria-label={label}
    >
      <svg viewBox="0 0 48 48" className="h-14 w-14 sm:h-16 sm:w-16" aria-hidden="true">
        <path
          d="M12 24 L20 32 L36 14"
          fill="none"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
