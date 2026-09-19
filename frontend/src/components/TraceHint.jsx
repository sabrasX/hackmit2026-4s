export default function TraceHint({ word }) {
  return (
    <p className="trace-hint text-5xl font-bold sm:text-6xl" aria-label={`Trace the word ${word}`}>
      {word}
    </p>
  )
}
