import { speak } from '../lib/speech.js'

export default function WordDisplay({ word, index, total }) {
  return (
    <div className="text-center">
      <p className="mb-4 text-lg font-semibold text-slate-500">
        Word {index + 1} of {total}
      </p>
      <div className="flex items-center justify-center gap-4">
        <h2 className="font-display text-6xl font-bold tracking-wide text-sky-700 sm:text-7xl md:text-8xl">
          {word}
        </h2>
        <button
          type="button"
          onClick={() => speak(word)}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
          style={{ background: 'var(--color-dusty-blue)' }}
          aria-label={`Hear the word ${word}`}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="currentColor" aria-hidden="true">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
