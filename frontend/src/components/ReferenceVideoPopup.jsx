import { useEffect, useRef, useState } from 'react'

/** A demonstration of the current word being written, shown when the struggle
 *  score stays high. It sits in the page corner, clear of the word at the top
 *  and the tick at the bottom centre, and the tick closes it by moving on.
 *
 *  A video at /videos/<word>.mp4 is used when one has been added; otherwise a
 *  grown-up can pick a clip from the device for this word.
 */
export default function ReferenceVideoPopup({ word, src, onPick, onClose }) {
  const videoRef = useRef(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    setUnavailable(false)
  }, [word, src])

  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [src])

  const handleFile = (event) => {
    const file = event.target.files?.[0]
    if (file) onPick(word, URL.createObjectURL(file))
  }

  return (
    <aside
      className="card-doodle fixed right-4 bottom-4 z-40 w-56 p-3 shadow-xl sm:w-64 lg:top-1/2 lg:right-6 lg:bottom-auto lg:-translate-y-1/2"
      role="dialog"
      aria-label={`How to write ${word}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-display text-sm font-bold text-sky-700">Watch how to write “{word}”</p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full px-2 text-lg leading-none text-slate-400 hover:text-slate-600"
          aria-label="Hide the video"
        >
          ×
        </button>
      </div>

      {src && !unavailable ? (
        <video
          ref={videoRef}
          src={src}
          className="w-full rounded-xl bg-slate-100"
          autoPlay
          loop
          muted
          playsInline
          controls
          onError={() => setUnavailable(true)}
        />
      ) : (
        <div className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">
          <p>No video for this word yet.</p>
          <label className="mt-2 inline-block cursor-pointer font-semibold text-sky-600 hover:underline">
            Choose a video
            <input type="file" accept="video/*" className="hidden" onChange={handleFile} />
          </label>
        </div>
      )}

      <p className="mt-2 text-center text-xs text-slate-400">
        Copy the posture, then tap the green check.
      </p>
    </aside>
  )
}
