// TODO: Writing session - steps: intro -> calibrating (10 s) -> writing -> done
// - Per word: show + speak word, send {type:'reset'}, feed useVisionStream statuses into the scorer
// - Show <SupportBanner level> using the scorer's support level (0-2)
// - <TickButton> -> scorer.finishWord(); after the last word saveSession() and go to /results
export default function Writing() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-black">Writing</h1>
      <p className="mt-2 text-slate-500">Placeholder - see the comments at the top of src/pages/Writing.jsx</p>
    </main>
  )
}
