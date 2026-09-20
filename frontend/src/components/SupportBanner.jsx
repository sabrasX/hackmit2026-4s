import { useEffect } from 'react'
import { speak } from '../lib/speech.js'
import TraceHint from './TraceHint.jsx'

const MESSAGES = {
  1: "You're doing great! Keep going!",
  2: "Let's trace the word together!",
  3: "Watch how it's written, then try again!",
}

export default function SupportBanner({ level, word }) {
  useEffect(() => {
    if (level >= 1 && word) {
      speak(`${MESSAGES[level] || MESSAGES[1]} ${word}`)
    }
  }, [level, word])

  if (!level) return null

  return (
    <div
      className={`card-doodle animate-bounce-gentle mx-auto max-w-lg p-6 text-center ${
        level >= 2 ? 'border-coral-bright' : ''
      }`}
      style={level >= 2 ? { borderColor: 'var(--color-coral-bright)' } : undefined}
      role="status"
    >
      <p className="font-display text-xl font-bold text-sky-700">
        {level === 1 ? '💪 ' : '✏️ '}
        {MESSAGES[level] || MESSAGES[1]}
      </p>
      {level >= 2 && word && (
        <div className="mt-4">
          <TraceHint word={word} />
        </div>
      )}
    </div>
  )
}
