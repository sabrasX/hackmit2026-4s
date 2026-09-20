import { useEffect, useRef } from 'react'
import { speak } from '../lib/speech.js'
import TraceHint from './TraceHint.jsx'

const MESSAGES = {
  1: "You're doing great! Keep going!",
  2: "Let's watch how to write it!",
}

export default function SupportBanner({ level, word, video }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (level >= 1 && word) {
      speak(`${MESSAGES[level] || MESSAGES[1]} ${word}`)
    }
  }, [level, word])

  // Restart the clip whenever the word changes, so the child always sees it
  // from the beginning rather than mid-stroke.
  useEffect(() => {
    if (level >= 2 && videoRef.current) {
      videoRef.current.currentTime = 0
      // Muted autoplay is allowed without a user gesture; these clips are silent.
      videoRef.current.play().catch(() => {})
    }
  }, [level, video, word])

  if (!level) return null

  return (
    <div
      className={`card-doodle animate-bounce-gentle mx-auto w-full max-w-lg p-5 text-center ${
        level >= 2 ? 'border-coral-bright' : ''
      }`}
      style={level >= 2 ? { borderColor: 'var(--color-coral-bright)' } : undefined}
      role="status"
    >
      <p className="font-display text-xl font-bold text-sky-700">
        {level === 1 ? '💪 ' : '🎬 '}
        {MESSAGES[level]}
      </p>

      {level >= 2 && word && (
        <div className="mt-4">
          {video ? (
            <video
              ref={videoRef}
              src={video}
              className="mx-auto w-full rounded-2xl bg-slate-900"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
            />
          ) : (
            <TraceHint word={word} />
          )}
        </div>
      )}
    </div>
  )
}
